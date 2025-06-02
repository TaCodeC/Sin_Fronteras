export const VERTEX_SHADER = `
  precision mediump float;
  attribute vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

export const FRAGMENT_SHADER = `
precision mediump float;

uniform vec2 u_resolution;
uniform float u_time;

// migration data uniforms
uniform float u_net_migration;      // controls mouth curvature (smile/frown)
uniform float u_percent_change;     // controls eye openness (alert/relaxed)
uniform float u_migration_trend;    // controls eyebrow angle and skin tint (0-1)
uniform float u_population_ratio;   // controls eye size (bigger eyes for larger populations)
uniform float u_has_data;           // 1.0 = has data, 0.0 = neutral face

// draw a smooth circle mask
float circle(vec2 uv, vec2 center, float radius) {
    return 1.0 - smoothstep(radius - 0.02, radius + 0.02, distance(uv, center));
}

// draw an ellipse mask
float ellipse(vec2 uv, vec2 center, vec2 size) {
    vec2 d = (uv - center) / size;
    return 1.0 - smoothstep(0.8, 1.0, length(d));
}

// mouth shape based on net migration: positive = smile, negative = frown
float mouth(vec2 uv, float net_migration) {
    vec2 center = vec2(0.5, 0.35);
    
    float x_norm = (uv.x - 0.5) / 0.15;
    float curve_y = center.y - net_migration * 0.08 * (1.0 - x_norm * x_norm);
    
    float mouth_line = 1.0 - smoothstep(0.02, 0.04, abs(uv.y - curve_y));
    float x_mask = 1.0 - smoothstep(0.12, 0.16, abs(uv.x - 0.5));
    
    return mouth_line * x_mask;
}

// eye shape with controlled openness based on percent change
float eye(vec2 uv, vec2 center, float size, float percent_change) {
    // percent_change comes normalized [-1, 1]
    // Low/negative change = VERY alert (much wider eyes)
    // High change = very relaxed (much narrower eyes)
    float change_factor = percent_change;
    float openness = 1.8 - (change_factor * 0.8); // much more dramatic range
    openness = clamp(openness, 0.3, 2.2); // allow much wider range
    
    float eye_shape = ellipse(uv, center, vec2(0.12 * size, 0.1 * size * openness));
    float pupil = circle(uv, center, 0.05 * size);
    float highlight = circle(uv, center + vec2(0.02, 0.02), 0.015 * size);
    
    return max(eye_shape - pupil + highlight, pupil * 0.3);
}

// eyebrow line based on migration trend (1=growth, 0=decline)
float eyebrow(vec2 uv, vec2 center, float trend, bool is_left) {
    vec2 start = center + vec2(-0.1, 0.12);
    vec2 end = center + vec2(0.1, 0.12);
    
    // trend is ONLY 1 or 0: 1=growth (arch up), 0=decline (arch down)
    float angle = (trend == 1.0) ? 0.15 : -0.15;
    
    if (is_left) {
        end.y += -angle; // opposite for left eyebrow
    } else {
        end.y += angle;
    }
    
    vec2 dir = normalize(end - start);
    vec2 topt = uv - start;
    float proj = dot(topt, dir);
    vec2 closest = start + dir * clamp(proj, 0.0, length(end - start));
    float dist = distance(uv, closest);
    
    return 1.0 - smoothstep(0.008, 0.02, dist);
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    vec3 base_skin = vec3(0.95, 0.9, 0.8);

    // if no data, draw completely neutral face
    if (u_has_data < 0.5) {
        float face = circle(uv, vec2(0.5, 0.5), 0.4);
        
        // Neutral eyes - standard size and openness
        float left_eye  = eye(uv, vec2(0.32, 0.62), 1.0, 0.0); // 0.0 = neutral openness
        float right_eye = eye(uv, vec2(0.68, 0.62), 1.0, 0.0);
        
        // Straight neutral mouth
        float neutral_mouth = 1.0 - smoothstep(0.01, 0.02, abs(uv.y - 0.28));
        neutral_mouth *= smoothstep(0.35, 0.36, uv.x) * smoothstep(0.64, 0.65, 1.0 - uv.x);
        
        // Neutral eyebrows for no-data face
        float left_brow  = eyebrow(uv, vec2(0.32, 0.62), 1.0, true);  // use 1.0 for flat
        float right_brow = eyebrow(uv, vec2(0.68, 0.62), 1.0, false); // but will be neutral context
        
        float features = max(max(left_eye, right_eye), max(neutral_mouth, max(left_brow, right_brow)));
        vec3 color = mix(base_skin, vec3(0.0), features);
        color = mix(vec3(0.8, 0.8, 0.9), color, face);
        
        gl_FragColor = vec4(color, 1.0);
        return;
    }

    // Dynamic face based on migration data
    float face = circle(uv, vec2(0.5, 0.5), 0.4);

    // MOUTH: controlled by net_migration (smile for positive, frown for negative)
    float mouth_shape = mouth(uv, u_net_migration);

    // EYE SIZE: controlled by population_ratio (MUCH bigger eyes for larger populations)
    float eye_size = 1.0 + (u_population_ratio * 15.0); // much more dramatic scaling

    // EYES: openness controlled by percent_change (low change = more alert/open)
    float left_eye  = eye(uv, vec2(0.32, 0.62), eye_size, u_percent_change);
    float right_eye = eye(uv, vec2(0.68, 0.62), eye_size, u_percent_change);

    // EYEBROWS: angle controlled by migration_trend
    float left_brow  = eyebrow(uv, vec2(0.32, 0.62), u_migration_trend, true);
    float right_brow = eyebrow(uv, vec2(0.68, 0.62), u_migration_trend, false);

    // SKIN COLOR: tinted by migration_trend (1=growth, 0=decline)
    vec3 face_color = base_skin;
    if (u_migration_trend > 0.) {
        // Growth = GREEN skin
        face_color = mix(base_skin, vec3(0.7, 1.0, 0.7), 0.7);
    } else {
        // Decline = RED skin
        face_color = mix(base_skin, vec3(1.0, 0.7, 0.7), 0.7);
    }

    // Combine all features
    float features = max(max(left_eye, right_eye), max(mouth_shape, max(left_brow, right_brow)));
    vec3 color = mix(face_color, vec3(0.0), features);
    color = mix(vec3(0.7, 0.7, 0.9), color, face);

    // Add subtle texture noise
    float noise = fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453);
    color += (noise - 0.5) * 0.02;

    gl_FragColor = vec4(color, 1.0);
}
`;