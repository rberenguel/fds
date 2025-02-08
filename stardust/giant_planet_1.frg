#version 300 es

// This is a minor modification of this shadertoy: https://www.shadertoy.com/view/tltXWM by kchnkrml, I found it on Reddit where he shared it: https://www.reddit.com/r/gamedev/comments/f0isdt/procedural_generation_simple_shaderbased_gas/

uniform vec3 iResolution;
uniform vec3 col_mid3;
uniform vec3 col_mid2;
uniform vec3 col_mid1;
uniform vec3 col_top;
uniform vec3 col_bot;
// number of octaves of fbm
#define NUM_NOISE_OCTAVES 20
// size of the planet

float iTime = 2.0f;
out vec4 fragColor;
//////////////////////////////////////////////////////////////////////////////////////
// Noise functions:
//////////////////////////////////////////////////////////////////////////////////////

// Precision-adjusted variations of https://www.shadertoy.com/view/4djSRW

float hash(float p) {
    p = fract(p * 0.011f);
    p *= p + 7.5f;
    p *= p + p;
    return fract(p);
}

float noise(vec3 x) {
    const vec3 step = vec3(110, 241, 171);
    vec3 i = floor(x);
    vec3 f = fract(x);
    float n = dot(i, step);
    vec3 u = f * f * (3.0f - 2.0f * f);
    return mix(mix(mix(hash(n + dot(step, vec3(0, 0, 0))), hash(n + dot(step, vec3(1, 0, 0))), u.x), mix(hash(n + dot(step, vec3(0, 1, 0))), hash(n + dot(step, vec3(1, 1, 0))), u.x), u.y), mix(mix(hash(n + dot(step, vec3(0, 0, 1))), hash(n + dot(step, vec3(1, 0, 1))), u.x), mix(hash(n + dot(step, vec3(0, 1, 1))), hash(n + dot(step, vec3(1, 1, 1))), u.x), u.y), u.z);
}

float fbm(vec3 x) {
    float v = 0.0f;
    float a = 0.5f;
    vec3 shift = vec3(100);
    for(int i = 0; i < NUM_NOISE_OCTAVES; ++i) {
        v += a * noise(x);
        x = x * 2.0f + shift;
        a *= 0.5f;
    }
    return v;
}

//////////////////////////////////////////////////////////////////////////////////////
// Visualization:
//////////////////////////////////////////////////////////////////////////////////////

const float pi = 3.1415926535f;
const float inf = 9999999.9f;
float square(float x) {
    return x * x;
}
float infIfNegative(float x) {
    return (x >= 0.0f) ? x : inf;
}

// returns max of a single vec3
float max3(vec3 v) {
    return max(max(v.x, v.y), v.z);
}

vec3 getColorForCoord(vec2 fragCoord) {
    // (intermediate) results of fbm
    vec3 q = vec3(0.0f);
    vec3 r = vec3(0.0f);
    float v = 0.0f;
    vec3 color = vec3(0.0f);

    // planet rotation
    float theta = iTime * 0.15f;
    mat3 rot = mat3(cos(theta), 0, sin(theta),	// column 1
    0, 1, 0,	                // column 2
    -sin(theta), 0, cos(theta)	// column 3
    );

    const float verticalFieldOfView = 30.0f * pi / 180.0f;

    fragCoord.xy /= iResolution.xy;

    // position of viewpoint (P) and ray of vision (w)
    vec3 P = vec3(0.0f, 0.0f, 5.0f);
    vec3 w = normalize(vec3(fragCoord.xy, 1.0f / (-4.0f * tan(verticalFieldOfView / 2.0f))));

    float t = 4.0f;

    vec3 X = P + w * t;

        // apply rotation matrix
    X = rot * X;

        // calculate fbm noise (3 steps)
    q = vec3(fbm(X + 0.025f * iTime), fbm(X), fbm(X));
    r = vec3(fbm(X + 1.0f * q + 0.01f * iTime), fbm(X + q), fbm(X + q));
    v = fbm(X + 5.0f * r + iTime * 0.005f);

    // mix mid color based on intermediate results
    vec3 col_mid = mix(col_mid1, col_mid2, clamp(r, 0.0f, 1.0f));
    col_mid = mix(col_mid, col_mid3, clamp(q, 0.0f, 1.0f));
    col_mid = col_mid;

    // calculate pos (scaling betwen top and bot color) from v
    float pos = v * 2.0f - 1.0f;
    color = mix(col_mid, col_top, clamp(pos, 0.0f, 1.0f));
    color = mix(color, col_bot, clamp(-pos, 0.0f, 1.0f));

    // clamp color to scale the highest r/g/b to 1.0
    color = color / max3(color);

    // create output color, increase light > 0.5 (and add a bit to dark areas)
    // These 0.9 control clarity
    color = (clamp((0.1f * pow(v, 2.f) + pow(v, 2.f) + 0.0f * v), 0.0f, 0.4f) * 0.4f + 0.1f) * color;

    // apply a smoothing to the outside
    color *= (P + w * t).z * 2.0f;

    return color;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    fragColor.rgb = getColorForCoord(fragCoord);
}

void main() {
    mainImage(fragColor, gl_FragCoord.xy);
}