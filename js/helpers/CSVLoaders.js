import Papa from "papaparse";

export async function loadCSV(url) {
  try {
    const migrationDataMap = new Map();
    const response = await fetch(url);
    const csvText = await response.text();
    const results = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      transformHeader: (header) => header.trim(),
    });

    if (results.errors.length > 0) {
      console.warn("Error parsing CSV data:", results.errors);
    }

    const rows = results.data;
    
    rows.forEach((row) => {
      if (row.code && typeof row.code === "string") {
        migrationDataMap.set(row.code.toUpperCase(), row);
      }
      if (row.code3 && typeof row.code3 === "string") {
        migrationDataMap.set(row.code3.toUpperCase(), row);
      }
      if (row.name && typeof row.name === "string") {
        migrationDataMap.set(row.name.toLowerCase(), row);
      }
    });

    console.log(`Loaded ${rows.length} countries with migration data`);
    return migrationDataMap;
  } catch (error) {
    console.error("Error loading migration data:", error);
    return new Map();
  }
}

export function findMigrationDataFromCSV(
  countryCode,
  countryName,
  migrationDataMap,
) {
  // ISO First
  if (countryCode) {
    const dataByCode = migrationDataMap.get(countryCode.toUpperCase());
    if (dataByCode) return dataByCode;
  }
  
  // country name if ISO does not match
  if (countryName) {
    const dataByName = migrationDataMap.get(countryName.toLowerCase());
    if (dataByName) return dataByName;
  }
  
  console.warn(
    `No migration data found for country: ${countryCode || countryName}`
  );
  
  // reuturn null, previoisly i returned 0 but that was causing issues, i don't know why
  return null;
}

export function getCSVMigrationUniforms(migrationData) {
  // Migration data?
  if (
    !migrationData ||
    migrationData === null ||
    isNaN(migrationData.total_net_migration) ||
    migrationData.total_net_migration === null
  ) {
    return {
      u_net_migration: 0.0,
      u_percent_change: 0.0,
      u_migration_trend: 0.5, //neutral value if no data
      u_population_ratio: 0.5,
      u_has_data: 0.0, // 1 = has data, 0 = neutral face
    };
  }

  const maxMigration = 1000000;
  const maxPopulation = 1400000000;

  let trendValue = 0.5; // Neutral value by default
  
  if (migrationData.migration_trend && typeof migrationData.migration_trend === 'string') {
    const trend = migrationData.migration_trend.toLowerCase().trim();
    
    console.log(`Processing trend for ${migrationData.name}: "${migrationData.migration_trend}" -> "${trend}"`);
    
    if (trend === "crecimiento") {
      trendValue = 1.0;
      console.log("-> Set to GROWTH (1.0)");
    } else if (trend === "decrecimiento") {
      trendValue = 0.0;
      console.log("-> Set to DECLINE (0.0)");
    } else {
      console.log(`-> Unknown trend "${trend}", keeping neutral (0.5)`);
    }
  } else {
    console.log(`No valid migration_trend for ${migrationData.name || 'unknown'}`);
  }

  // normalize values
  const netMigration = Math.max(
    -1,
    Math.min(1, (migrationData.total_net_migration || 0) / maxMigration)
  );
  
  const percentChange = Math.max(
    -1,
    Math.min(1, (migrationData.percent_change || 0) / 100)
  );
  
  const populationRatio = Math.min(
    1,
    (migrationData.population_2022 || 1000000) / maxPopulation
  );

  return {
    u_net_migration: netMigration,
    u_percent_change: percentChange,
    u_migration_trend: trendValue,
    u_population_ratio: populationRatio,
    u_has_data: 1.0,
  };
}