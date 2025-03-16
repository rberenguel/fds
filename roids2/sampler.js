const drumSampler = new Tone.Sampler({
  attack: 0,
  urls: {
    c0: "ride1_OH_FF_1.mp3",
    c1: "ride1_OH_MP_1.mp3",
    c2: "ride1_OH_FF_3.mp3",
    b0: "hihatFootStomp_OH_MP_1.mp3",
    b1: "hihatFootStomp_OH_MP_3.mp3",
    b2: "hihatFootStomp_OH_MP_4.mp3",
    d0: "hihatClosed_OH_F_1.mp3",
    e0: "snare_OH_F_1.mp3",
    e1: "snare2_OH_Ghost_1.mp3", // Emergency brake
    f0: "crash1_OH_FF_1.mp3",
    f1: "crash2_OH_FF_1.mp3",
    f2: "crash2_OH_FF_3.mp3",
    g0: "snareStick_OH_F_3.mp3",
    a0: "splash1_OH_F_1.mp3",
    a1: "splash1_OH_F_3.mp3",
    a2: "splash1_OH_P_1.mp3",
    a3: "china1Choke_OH_F_1.mp3",
    a4: "cowbell_FF_1.mp3",
    a5: "loTom_OH_FF_1.mp3",
  },
  baseUrl: "drums/",
  curve: "exponential",
  release: 0.9,
  volume: -30,
  onload: () => {},
}).toDestination();

window.drumSampler = drumSampler;
