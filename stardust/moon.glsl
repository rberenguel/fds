#version 300 es

uniform vec3 iResolution;
uniform vec3 in_color;
uniform float shifting;

out vec4 fragColor;

const float PI = 3.14159265358;

// I got the basin / ridge from here https://www.shadertoy.com/view/wljcRd but
// tweaked everything to not need any additional textures, and added a random
// amount of craters of different sizes

// --- Hash Functions  ---
float hash12(vec2 p, float seed) {
    vec3 p3 = fract(vec3(p.xyx) * .1031 + seed);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

vec2 hash22(vec2 p, float seed) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973) + seed);
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.xx + p3.yz) * p3.zy);
}

// --- 2D Noise (Perlin) ---
float noise(vec2 p, float seed) {
    vec2 ip = floor(p);
    vec2 u = fract(p);
    u = u * u * (3. - 2. * u);
    float res = mix(mix(hash12(ip, seed), hash12(ip + vec2(1, 0), seed), u.x), mix(hash12(ip + vec2(0, 1), seed), hash12(ip + vec2(1, 1), seed), u.x), u.y);
    return res * res;
}

// --- Fractal Brownian Motion  ---
float fbm(vec2 p, int octaves, float persistence, float lacunarity, float seed) {
    float value = 0.0;
    float amplitude = 1.0;
    float frequency = 1.0;
    for(int i = 0; i < octaves; i++) {
        value += amplitude * noise(p * frequency, seed);
        amplitude *= persistence;
        frequency *= lacunarity;
    }
    return value;
}

// --- Crater bowl ---
float bowl(float r, float radius, float bottom) {
    float c = -bottom;
    float a = bottom / (radius * radius);
    float y = a * r * r + c;
    return clamp(y, -1., 0.);
}

// --- Crater ridge ---
float ridge(float r, float radius) {
    return smoothstep(0., .7, 1. * (.5 - clamp(r, radius, .5)));
}

// --- Height Function ---
float height(vec2 uv, float seed) {
    float total_height = 0.0;
    float cell_size = .7;
    vec2 cell = floor(uv / cell_size);

    float height_noise = fbm(uv * 7.0, 5, 0.7, 2.2, seed) * 0.1;
    height_noise = pow(abs(height_noise), 1.2);

    for(int i = -1; i <= 1; i++) {
        for(int j = -1; j <= 1; j++) {
            vec2 cell_offset = vec2(i, j);
            vec2 current_cell = cell + cell_offset;

            float probability = hash12(current_cell * 123.45, seed);
            if(probability < 0.7) {
                float radius_rand = hash12(current_cell * 67.89, seed);
                float radius = 0.05 + pow(radius_rand, 3.0) * 0.7;

                // --- Limit bottom/radius Ratio ---
                float bottom = mix(0.2, 0.9, hash12(current_cell * 42.13, seed));
                bottom = min(bottom, radius * 2.5); // Ensure bottom is not too large relative to radius

                vec2 offset = hash22(current_cell * 91.57, seed) * cell_size * 0.8;

                vec2 crater_uv = uv - (current_cell * cell_size + offset);

                // FBM UV Perturbation
                vec2 fbm_uv = uv * 3.0;
                vec2 perturbation = vec2(fbm(fbm_uv, 4, 0.6, 2.5, seed), fbm(fbm_uv + vec2(5.2, 1.3), 4, 0.6, 2.5, seed)) * 0.2;
                crater_uv += perturbation;

                float r = length(crater_uv);
                float crater_height = bowl(r, radius, bottom) + ridge(r, radius);
                total_height += crater_height;
            }

        }
    }
    total_height = clamp(total_height + height_noise, -1.5, 1.5);
    return total_height;
}

// --- Normal Function  ---
vec3 normal(vec2 uv, float seed) {
    const float eps = 0.002;
    const vec2 h = vec2(eps, 0);

    vec3 n = vec3(height(uv - h.xy, seed) - height(uv + h.xy, seed), height(uv - h.yx, seed) - height(uv + h.yx, seed), eps * 8.0);
    vec3 n1 = vec3(height(uv - h.xy - h.yx, seed) - height(uv + h.xy - h.yx, seed), height(uv - h.yx - h.xy, seed) - height(uv + h.yx - h.xy, seed), eps * 8.0);
    vec3 n2 = vec3(height(uv - h.xy + h.yx, seed) - height(uv + h.xy + h.yx, seed), height(uv - h.yx + h.xy, seed) - height(uv + h.yx + h.xy, seed), eps * 8.0);

    return normalize((n + n1 + n2) / 3.0);
}

// --- mainImage ---
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    float scale = 5.2;
    vec2 uv = scale * (fragCoord - .5 * iResolution.xy) / iResolution.y;

    vec3 n = normal(uv, shifting);
    vec3 light_dir = normalize(vec3(0.3535, 0.3535, 0.866));

    float diffuse = 0.8 * max(0.0, dot(n, light_dir));
    float ambient = 0.3;
    vec3 color = in_color * (ambient + diffuse) + vec3(0.0) * height(uv, shifting);

    fragColor = vec4(color * color, 1.0);
}

void main() {
    mainImage(fragColor, gl_FragCoord.xy);
}