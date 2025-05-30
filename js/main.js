import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import SpectatorControls from './SpectatorControls.js';
import { loadGJsonSVG } from './helpers/gJson.js';
let windowWidth = window.innerWidth;
let windowHeight = window.innerHeight;

const renderer = new THREE.WebGLRenderer({ antialias: true });
const scene = new THREE.Scene();
const light = new THREE.DirectionalLight(0xffffff, 1);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const camControls = new SpectatorControls(camera);
const clock = new THREE.Clock();
const canvas = renderer.domElement;

const svgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
svgElement.setAttribute('xmlns', "http://www.w3.org/2000/svg");
svgElement.setAttribute('viewBox', '0 0 1000 1000');
svgElement.style.display = 'none';
document.body.appendChild(svgElement);


renderer.setSize(windowWidth, windowHeight);
document.body.appendChild(renderer.domElement);
scene.background = new THREE.Color(1,1,1);
light.position.set(1, 1, 1);
camera.position.set(800, 0, 400);
camControls.disable();

scene.add(light);

loadGJsonSVG('globalGJson.json', svgElement, (svgData) => {
    svgData.paths.forEach(path => {
        const shapes = SVGLoader.createShapes(path);
        shapes.forEach(shape => {
            const geometry = new THREE.ShapeGeometry(shape);
            const material = new THREE.MeshBasicMaterial({ color: 0x4CAF50, side: THREE.DoubleSide });
            const mesh = new THREE.Mesh(geometry, material);
            scene.add(mesh);
        });
    });
});

camControls.enable();
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    camControls.update(delta);
    renderer.render(scene, camera);
}
animate();



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
        control.enable();
    } else {
        control.disable();
    }
});
