import { SVGLoader } from "three/addons/loaders/SVGLoader.js";

export function loadGJsonSVG(url, svgElement, callback) {
  fetch(url)
    .then(response => response.json())
    .then(data => {
      data.features.forEach(feature => {
        if (feature.geometry.type === 'Polygon') {
          const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
          path.setAttribute('d', coordsToPath(feature.geometry.coordinates));
          path.setAttribute('fill', '#4CAF50');
          path.setAttribute('stroke', '#222');
          svgElement.appendChild(path);
        }
      });

     
      const svgString = svgElement.outerHTML;
      const blob = new Blob([svgString], { type: 'image/svg+xml' });
      const urlObject = URL.createObjectURL(blob);

      const loader = new SVGLoader();
      loader.load(urlObject, svgData => {
        callback(svgData); 
        URL.revokeObjectURL(urlObject); 
      });
    })
    .catch(error => {
      console.error('Error al cargar el GeoJSON:', error);
    });
}

function coordsToPath(coords) {
  return coords[0].map(([lon, lat], i) => {
    const [x, y] = lonLatToXY(lon, lat);
    return `${i === 0 ? 'M' : 'L'}${x},${y}`;
  }).join(' ') + ' Z';
}

function lonLatToXY(lon, lat) {
  const scale = 10;
  return [500 + lon * scale, 500 - lat * scale];
}
