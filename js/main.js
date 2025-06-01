import * as THREE from 'three';
import SpectatorControls from './SpectatorControls.js';

let WIDTH = window.innerWidth;
let HEIGHT = window.innerHeight;
let countries = []; // Array to store country meshes
let countriesGroup = new THREE.Group(); // Group to hold all countries
let currentHoveredCountry = null;
let raycaster = new THREE.Raycaster();

const renderer = new THREE.WebGLRenderer({ antialias: true });
const scene = new THREE.Scene();
const light = new THREE.DirectionalLight(0xffffff, 1);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const camControls = new SpectatorControls(camera);
const clock = new THREE.Clock();
const canvas = renderer.domElement;

// floor (ocean)
const floorGeometry = new THREE.PlaneGeometry(2000, 2000);
const floorMaterial = new THREE.MeshLambertMaterial({ color: new THREE.Color(.1,.1,1) }); 
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2;
floor.position.y = 8.5; // Slightly below the camera
floor.receiveShadow = true;
scene.add(floor);

// Add countries group to scene
scene.add(countriesGroup);

// world 

loadGeoJSONFile("./js/data/globalGJson.json");



renderer.setSize(WIDTH, HEIGHT);
document.body.appendChild(renderer.domElement);
scene.background = new THREE.Color(1,1,1);
light.position.set(1, 1, 1);
camera.position.set(0, 20, 0);
camControls.disable();

scene.add(light);

// Rotate the countries group to be horizontal
countriesGroup.rotation.x = -Math.PI / 2;
countriesGroup.scale.set(10, 10, 10); 
camControls.enable();

animate();

function animate() {
    requestAnimationFrame(animate);
    
    const delta = clock.getDelta();
    camControls.update(delta);
    
    checkPlayerOverCountry();
    
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
    
    console.log(`losading ${geoJsonData.features.length} countries...`);
    
    geoJsonData.features.forEach((feature, index) => {
        if (feature.geometry) {
            const countryName = feature.properties?.name || feature.properties?.name_en || `País ${index}`;
            
            if (feature.geometry.type === 'Polygon') {
                const country = createCountryFromPolygon(feature.geometry.coordinates[0], countryName);
                countries.push(country);
                countriesGroup.add(country); // Add to a group to modify world
            } 
            else if (feature.geometry.type === 'MultiPolygon') {
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
                countriesGroup.add(country); // Add to a group 
            }
        }
    });
    
    console.log(`${countries.length} countries loaded.`);
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
        const x = coord[0]; // longitude
        const z = coord[1]; // latitude
        
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
        transparent: false,
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
        const targetScale = 3;
        const duration = 800;
        const startTime = Date.now();
        const originalScale = country.scale.y;
        
        function animate() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            
            country.scale.z = originalScale + (targetScale - originalScale) * easeProgress;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        }
        
        animate();
        country.userData.isExtruded = true;
    }
}

function restoreCountryHeight(country) {
    if (country.userData.isExtruded) {
        const targetScale = 1;
        const duration = 900;
        const startTime = Date.now();
        const originalScale = country.scale.y;
        
        function animate() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            
            country.scale.z = originalScale + (targetScale - originalScale) * easeProgress;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        }
        
        animate();
        country.userData.isExtruded = false;
    }
}