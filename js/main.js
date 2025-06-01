/*
** OCEAN & SKY BASED ON THREE.JS EXAMPLE FROM: https://github.com/mrdoob/three.js/blob/dev/examples/webgl_shaders_ocean.html
**
**
**/

import * as THREE from 'three';
import SpectatorControls from './SpectatorControls.js';
import { Water } from 'three/addons/objects/Water.js';
import { Sky } from 'three/addons/objects/Sky.js';

let WIDTH = window.innerWidth;
let HEIGHT = window.innerHeight;
let countries = []; // Array to store country meshes
let countriesGroup = new THREE.Group();  // Group to hold all countries
let currentHoveredCountry = null;
let raycaster = new THREE.Raycaster();
let FLOOR_HEIGHT = 8.5; // Height of the ocean floor

let water;   
let sky;      
let sun;      // this vector will hold the sun position
let pmremGenerator; 

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(WIDTH, HEIGHT);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.5;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();

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
water = new Water(
  waterGeometry,
  {
    textureWidth: 512,
    textureHeight: 512,
    waterNormals: new THREE.TextureLoader().load('./js/textures/waternormals.jpg', function(texture) {
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    }),
    sunDirection: new THREE.Vector3(), 
    sunColor: 0xffffff,
    waterColor: 0x001e0f,
    distortionScale: 3.7,
    fog: scene.fog !== undefined
  }
);
water.rotation.x = -Math.PI / 2;
scene.add(water);

//  SKY CONF
sky = new Sky();
sky.scale.setScalar(10000);
scene.add(sky);

const skyUniforms = sky.material.uniforms;
skyUniforms['turbidity'].value = 10;
skyUniforms['rayleigh'].value = 2;
skyUniforms['mieCoefficient'].value = 0.005;
skyUniforms['mieDirectionalG'].value = 0.8;

sun = new THREE.Vector3();

// PMREM
pmremGenerator = new THREE.PMREMGenerator(renderer);

// Sun position parameters
const parameters = {
  elevation: 2,   // vertical angle of the sun (0° = horizon, 90° = zenith)
  azimuth: 180    // Sun’s horizontal angle (0° = North)

};

function updateSun() {
  const phi = THREE.MathUtils.degToRad(90 - parameters.elevation);
  const theta = THREE.MathUtils.degToRad(parameters.azimuth);

  sun.setFromSphericalCoords(1, phi, theta);


  sky.material.uniforms['sunPosition'].value.copy(sun);

  water.material.uniforms['sunDirection'].value.copy(sun).normalize();

  // gen environment map
  const renderTarget = pmremGenerator.fromScene(sky);
  scene.environment = renderTarget.texture;
}

updateSun();

// temp directional light
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(5, 10, 7.5);
scene.add(dirLight);

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

  water.material.uniforms['time'].value += 1.0 / 60.0;

  checkPlayerOverCountry();
  gravity(delta);

  renderer.render(scene, camera);
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
canvas.addEventListener('click', () => {
  canvas.requestPointerLock();
});
document.addEventListener('pointerlockchange', () => {
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
  console.log('Loading:', url);

  fetch(url)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      console.log('gJson loaded:', data);
      loadCountriesFromGeoJSON(data);
    })
    .catch(error => {
      console.error('Error loading gJson', error);
    });
}

function loadCountriesFromGeoJSON(geoJsonData) {
  if (!geoJsonData || !geoJsonData.features || !Array.isArray(geoJsonData.features)) {
    console.error('gJson (?). Invalid', geoJsonData);
    return;
  }

  console.log(`Cargando ${geoJsonData.features.length} países...`);

  geoJsonData.features.forEach((feature, index) => {
    if (feature.geometry) {
      const countryName = feature.properties?.name || feature.properties?.name_en || `País ${index}`;

      if (feature.geometry.type === 'Polygon') {
        const country = createCountryFromPolygon(feature.geometry.coordinates[0], countryName);
        countries.push(country);
        countriesGroup.add(country);
      } else if (feature.geometry.type === 'MultiPolygon') {
        let largestPolygon = feature.geometry.coordinates[0];
        let maxArea = 0;

        feature.geometry.coordinates.forEach(polygon => {
          const area = calculatePolygonArea(polygon[0]);
          if (area > maxArea) {
            maxArea = area;
            largestPolygon = polygon;
          }
        });

        const country = createCountryFromPolygon(largestPolygon[0], countryName);
        countries.push(country);
        countriesGroup.add(country);
      }
    }
  });

  console.log(`${countries.length} países cargados.`);
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
    steps: 1
  };
  const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  const material = new THREE.MeshLambertMaterial({
    color: new THREE.Color(Math.random(), Math.random(), Math.random()),
    transparent: false
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData = {
    name: name,
    originalHeight: 5,
    isExtruded: false
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
  }

  if (currentHoveredCountry !== newHoveredCountry) {
    if (currentHoveredCountry) {
      restoreCountryHeight(currentHoveredCountry);
    }
    if (newHoveredCountry) {
      extrudeCountry(newHoveredCountry);
      console.log('Ct:', newHoveredCountry.userData.name);
    }
    currentHoveredCountry = newHoveredCountry;
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
      country.scale.z = originalScale + (targetScale - originalScale) * easeProgress;
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
        country.scale.z = originalScale + (targetScale - originalScale) * easeProgress;
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
    camera.position.y = Math.max(camera.position.y - fallDistance, targetHeight);
  } else {
    camera.position.y = targetHeight;
  }
}
