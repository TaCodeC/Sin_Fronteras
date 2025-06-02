/*
  ** OCEAN & SKY BASED ON THREE.JS EXAMPLE FROM: https://github.com/mrdoob/three.js/blob/dev/examples/webgl_shaders_ocean.html
  **
  ** I should comment the console.log calls, they are for debugging purposes, but i'm leaving them here for now, i'm lazy
  **/

  import * as THREE from "three";
  import SpectatorControls from "./SpectatorControls.js";
  import { Water } from "three/addons/objects/Water.js";
  import { Sky } from "three/addons/objects/Sky.js";
  import Stats from "three/addons/libs/stats.module.js";
  import CountryHUD from "./helpers/UI.js";
  import { loadCSV, findMigrationDataFromCSV, getCSVMigrationUniforms} from "./helpers/CSVLoaders.js";  

  let stats;



  let WIDTH = window.innerWidth;
  let HEIGHT = window.innerHeight;
  let countries = []; // Array to store country meshes
  let countriesGroup = new THREE.Group(); // Group to hold all countries
  let currentHoveredCountry = null;
  let raycaster = new THREE.Raycaster();
  let FLOOR_HEIGHT = 8.5; // Height of the ocean floor

  let water;
  let sky;
  let sun; // this vector will hold the sun position
  let pmremGenerator;


  let currentMigrationValue = 0; 
  let targetSunElevation = 2; 
  let currentSunElevation = 2; 
  const sunTransitionSpeed = 30;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(WIDTH, HEIGHT);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.5;
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  //hud
  const countryHUD = new CountryHUD();
  let migrationDataCSV = [];
  let migrationDataMap = await loadCSV("./js/data/DB.csv")
  /*
  **FPS DEBUGGER
  **
  **
  */
  stats = new Stats();
  document.body.appendChild(stats.dom);

  // CAM & CONTROLS
  const camera = new THREE.PerspectiveCamera(75, WIDTH / HEIGHT, 0.1, 20000);
  camera.position.set(0, 20, 100);
  const camControls = new SpectatorControls(camera);
  const clock = new THREE.Clock();
  const canvas = renderer.domElement;
  const countryAnimations = new Map(); // track country animations

  const WD = 15; // Scale for the world

  //  OCEAN WATER CONF
  const waterGeometry = new THREE.PlaneGeometry(10000, 10000);
  water = new Water(waterGeometry, {
    textureWidth: 512,
    textureHeight: 512,
    waterNormals: new THREE.TextureLoader().load(
      "./js/textures/waternormals.jpg",
      function (texture) {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      }
    ),
    sunDirection: new THREE.Vector3(),
    sunColor: 0xffffff,
    waterColor: 0x001e0f,
    distortionScale: 3.7,
    fog: scene.fog !== undefined,
  });
  water.rotation.x = -Math.PI / 2;
  scene.add(water);

  //  SKY CONF
  sky = new Sky();
  sky.scale.setScalar(10000);
  scene.add(sky);

  const skyUniforms = sky.material.uniforms;
  skyUniforms["turbidity"].value = 10;
  skyUniforms["rayleigh"].value = 2;
  skyUniforms["mieCoefficient"].value = 0.005;
  skyUniforms["mieDirectionalG"].value = 0.8;

  sun = new THREE.Vector3();

  // PMREM, i dont have any idea what this is, but it is needed for the sky: https://threejs.org/docs/#api/en/extras/PMREMGenerator
  pmremGenerator = new THREE.PMREMGenerator(renderer);

  // Sun position parameters
  const parameters = {
    elevation: 2, // vertical angle of the sun (0° = horizon, 90° = zenith)
    azimuth: 180, // Sun's horizontal angle (0° = North)
  };
  // temp directional light
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(5, 10, 7.5);
  scene.add(dirLight);

  function updateSun(deltaTime) {
      const elevationDiff = targetSunElevation - currentSunElevation;
      
      if (Math.abs(elevationDiff) > 0.1) {
          const transitionStep = sunTransitionSpeed * deltaTime;
          const step = Math.sign(elevationDiff) * Math.min(Math.abs(elevationDiff), transitionStep);
          currentSunElevation += step;
      } else {
          currentSunElevation = targetSunElevation;
      }
      
      const phi = THREE.MathUtils.degToRad(90 - currentSunElevation);
      const theta = THREE.MathUtils.degToRad(parameters.azimuth);
      
      sun.setFromSphericalCoords(1, phi, theta);
      
      sky.material.uniforms["sunPosition"].value.copy(sun);
      water.material.uniforms["sunDirection"].value.copy(sun).normalize();
      
      const lightIntensity = Math.max(0.1, Math.sin(THREE.MathUtils.degToRad(Math.max(0, currentSunElevation))));
      dirLight.intensity = lightIntensity;
      
      if (currentSunElevation < 0) {
          water.material.uniforms["waterColor"].value = new THREE.Color(0x000408);
      } else if (currentSunElevation < 10) {
          water.material.uniforms["waterColor"].value = new THREE.Color(0x001122);
      } else {
          water.material.uniforms["waterColor"].value = new THREE.Color(0x001e0f);
      }
      
      // Update country glow based on sun elevation
      updateCountryGlow();
      
      const renderTarget = pmremGenerator.fromScene(sky);
      scene.environment = renderTarget.texture;
  }

  function updateCountryGlow() {
      // Calculate glow intensity based on sun elevation
      // When sun is below horizon (elevation < 0), countries should glow more
      const normalizedElevation = THREE.MathUtils.clamp((currentSunElevation + 20) / 40, 0, 1);
      const glowIntensity = 1 - normalizedElevation; // Inverted: more glow when sun is lower
      
      countries.forEach(country => {
          if (country.material) {
              // Set emissive color based on original color but dimmed
              const originalColor = country.userData.originalColor || country.material.color;
              const emissiveColor = originalColor.clone().multiplyScalar(glowIntensity * 0.3);
              
              country.material.emissive = emissiveColor;
              
              // Add extra glow for hovered country
              if (country === currentHoveredCountry) {
                  const hoveredGlow = originalColor.clone().multiplyScalar(0.5);
                  country.material.emissive.add(hoveredGlow);
              }
          }
      });
  }

  initializeSun();


  scene.add(countriesGroup);

  loadGeoJSONFile("./js/data/globalGJson.json");

  scene.background = new THREE.Color(0x000000);
  renderer.setSize(WIDTH, HEIGHT);

  camControls.disable();
  countriesGroup.rotation.x = -Math.PI / 2;
  countriesGroup.scale.set(WD, WD, WD);
  camControls.enable();

  animate();

  function animate() {
      requestAnimationFrame(animate);

      const delta = clock.getDelta();
      camControls.update(delta);

      water.material.uniforms["time"].value += 1.0 / 60.0;

      checkPlayerOverCountry();
      
      updateSun(delta);
      
      gravity(delta);

      renderer.render(scene, camera);
      stats.update();
  }

  // Window resize handler
  window.onresize = () => {
    WIDTH = window.innerWidth;
    HEIGHT = window.innerHeight;
    camera.aspect = WIDTH / HEIGHT;
    camera.updateProjectionMatrix();
    renderer.setSize(WIDTH, HEIGHT);
  };
  // Mouse lock
  canvas.addEventListener("click", () => {
    canvas.requestPointerLock();
  });
  document.addEventListener("pointerlockchange", () => {
    if (document.pointerLockElement === canvas) {
      camControls.enable();
    } else {
      camControls.disable();
    }
  });

  /*
  ** GEOJSON LOADER
  */

  function loadGeoJSONFile(url) {
    console.log("Loading:", url);

    fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        console.log("gJson loaded:", data);
        loadCountriesFromGeoJSON(data);
      })
      .catch((error) => {
        console.error("Error loading gJson", error);
      });
  }

  function loadCountriesFromGeoJSON(geoJsonData) {
    if (
      !geoJsonData ||
      !geoJsonData.features ||
      !Array.isArray(geoJsonData.features)
    ) {
      console.error("gJson (?). Invalid", geoJsonData);
      return;
    }

    console.log(`loading ${geoJsonData.features.length} countries...`);

    geoJsonData.features.forEach((feature, index) => {
      if (feature.geometry) {
        const countryName =
          feature.properties?.name ||
          feature.properties?.name_en ||
          `País ${index}`;

        if (feature.geometry.type === "Polygon") {
          const country = createCountryFromPolygon(
            feature.geometry.coordinates[0],
            countryName
          );
          countries.push(country);
          countriesGroup.add(country);
        } else if (feature.geometry.type === "MultiPolygon") {
          let largestPolygon = feature.geometry.coordinates[0];
          let maxArea = 0;

          feature.geometry.coordinates.forEach((polygon) => {
            const area = calculatePolygonArea(polygon[0]);
            if (area > maxArea) {
              maxArea = area;
              largestPolygon = polygon;
            }
          });

          const country = createCountryFromPolygon(
            largestPolygon[0],
            countryName
          );
          countries.push(country);
          countriesGroup.add(country);
        }
      }
    });

    console.log(`${countries.length} countries loaded`);
    
    // Initialize glow after all countries are loaded
    updateCountryGlow();
  }

  function calculatePolygonArea(coordinates) {
    let area = 0;
    for (let i = 0; i < coordinates.length - 1; i++) {
      area += coordinates[i][0] * coordinates[i + 1][1];
      area -= coordinates[i + 1][0] * coordinates[i][1];
    }
    return Math.abs(area) / 2;
  }

  function createCountryFromPolygon(coordinates, name) {
    const shape = new THREE.Shape();
    coordinates.forEach((coord, index) => {
      const x = coord[0];
      const z = coord[1];
      if (index === 0) {
        shape.moveTo(x, z);
      } else {
        shape.lineTo(x, z);
      }
    });

    const extrudeSettings = {
      depth: 1,
      bevelEnabled: false,
      steps: 1,
    };
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    
    // Generate a more vibrant color for better glow effect
    const baseColor = new THREE.Color();
    baseColor.setHSL(Math.random(), 0.7, 0.6); // Higher saturation and lightness
    
    const material = new THREE.MeshLambertMaterial({
      color: baseColor,
      transparent: false,
      emissive: new THREE.Color(0x000000), // Start with no emission
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.userData = {
      name: name,
      originalHeight: 5,
      isExtruded: false,
      originalColor: baseColor.clone(), // Store original color for glow calculations
    };
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  function checkPlayerOverCountry() {
      const playerPosition = camera.position.clone();
      const downDirection = new THREE.Vector3(0, -1, 0);
      raycaster.set(playerPosition, downDirection);
      const intersects = raycaster.intersectObjects(countries);
      let newHoveredCountry = null;
      
      if (intersects.length > 0) {
          newHoveredCountry = intersects[0].object;
      } else {
          countryHUD.setCountry("Ocean");
          // Reset sun elevation when not hovering over a country
          updateSunBasedOnMigration(0);
      }
      
      if (currentHoveredCountry !== newHoveredCountry) {
          if (currentHoveredCountry) {
              restoreCountryHeight(currentHoveredCountry);
          }
          
          if (newHoveredCountry) {
              extrudeCountry(newHoveredCountry);
              console.log("Ct:", newHoveredCountry.userData.name);
              console.log("function called");
              countryHUD.setCountry(newHoveredCountry.userData.name);
              
              // READ MIGRATION DATA FROM CSV
              console.log("Country userData:", newHoveredCountry.userData);
              
              const countryName = newHoveredCountry.userData.name;
              const countryCode = null; 
              
              console.log(`Searching for: "${countryName}"`);
              
              const migrationData = findMigrationDataFromCSV(countryCode, countryName, migrationDataMap);
              console.log("Migration data found:", migrationData);
              
              const migrationUniforms = getCSVMigrationUniforms(migrationData);
              console.log("Generated uniforms:", migrationUniforms);
              
              // NUEVA FUNCIONALIDAD: Actualizar el sol basado en migración neta
              currentMigrationValue = migrationUniforms.u_net_migration;
              updateSunBasedOnMigration(currentMigrationValue);
              
              // UPDATE CHERNOFF FACES UNIFORMS
              countryHUD.updateUniforms(migrationUniforms);
              
              console.log("Migration data from CSV:", migrationData ? 
                  `${migrationData.name}: ${migrationData.total_net_migration}, Sun: ${targetSunElevation.toFixed(1)}°` : "No data");
          }
          
          currentHoveredCountry = newHoveredCountry;
          
          // Update glow when hovered country changes
          updateCountryGlow();
      }
  }


  function extrudeCountry(country) {
    if (!country.userData.isExtruded) {
      // cancel any ongoing animation for this country
      if (countryAnimations.has(country)) {
        cancelAnimationFrame(countryAnimations.get(country));
      }
      const targetScale = 3;
      const duration = 5000;
      const startTime = Date.now();
      const originalScale = country.scale.z;
      function animateScale() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        country.scale.z =
          originalScale + (targetScale - originalScale) * easeProgress;
        if (progress < 1) {
          const animationId = requestAnimationFrame(animateScale);
          countryAnimations.set(country, animationId);
        } else {
          countryAnimations.delete(country);
        }
      }
      animateScale();
      country.userData.isExtruded = true;
    }
  }

  function restoreCountryHeight(country) {
    return new Promise((resolve) => {
      if (country.userData.isExtruded) {
        // cancel any ongoin anim
        if (countryAnimations.has(country)) {
          cancelAnimationFrame(countryAnimations.get(country));
          countryAnimations.delete(country);
        }
        const targetScale = 1;
        const duration = 1000;
        const startTime = Date.now();
        const originalScale = country.scale.z;
        function animateScale() {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const easeProgress = 1 - Math.pow(1 - progress, 3);
          country.scale.z =
            originalScale + (targetScale - originalScale) * easeProgress;
          if (progress < 1) {
            const animationId = requestAnimationFrame(animateScale);
            countryAnimations.set(country, animationId);
          } else {
            country.scale.z = targetScale;
            country.userData.isExtruded = false;
            countryAnimations.delete(country);
            resolve();
          }
        }
        animateScale();
      } else {
        resolve();
      }
    });
  }

  function gravity(deltaTime) {
    const gravityForce = 9.81 * 2;
    const playerPosition = camera.position.clone();
    const downDirection = new THREE.Vector3(0, -1, 0);

    raycaster.set(playerPosition, downDirection);
    const intersects = raycaster.intersectObjects(countries);

    let targetHeight = FLOOR_HEIGHT + 12; // Minimum height above the ocean floor
    if (intersects.length > 0) {
      const intersectionPoint = intersects[0].point;
      targetHeight = intersectionPoint.y + 2;
    }

    // only apply gravity if the camera is above the target height
    if (camera.position.y > targetHeight) {
      const fallDistance = gravityForce * deltaTime;
      camera.position.y = Math.max(
        camera.position.y - fallDistance,
        targetHeight
      );
    } else {
      camera.position.y = targetHeight;
    }
  }

  function updateSunBasedOnMigration(migrationValue) {
      if (migrationValue <= -0.5) {
          targetSunElevation = -20 + (migrationValue + 1) * 30;
      } else if (migrationValue < 0) {
          targetSunElevation = -5 + (migrationValue + 0.5) * 30;
      } else if (migrationValue === 0) {
          targetSunElevation = 10;
      } else {
          targetSunElevation = 10 + migrationValue * 35;
      }
      
      console.log(`Migration: ${migrationValue.toFixed(3)} -> Target sun elevation: ${targetSunElevation.toFixed(1)}°`);
  }

  function debugSunValues() {
      console.log({
          migrationValue: currentMigrationValue,
          targetElevation: targetSunElevation,
          currentElevation: currentSunElevation,
          lightIntensity: dirLight.intensity
      });
  }

  function initializeSun() {
      const phi = THREE.MathUtils.degToRad(90 - currentSunElevation);
      const theta = THREE.MathUtils.degToRad(parameters.azimuth);
      
      sun.setFromSphericalCoords(1, phi, theta);
      
      sky.material.uniforms["sunPosition"].value.copy(sun);
      water.material.uniforms["sunDirection"].value.copy(sun).normalize();
      
      const lightIntensity = Math.max(0.1, Math.sin(THREE.MathUtils.degToRad(Math.max(0, currentSunElevation))));
      dirLight.intensity = lightIntensity;
      
      const renderTarget = pmremGenerator.fromScene(sky);
      scene.environment = renderTarget.texture;
  }