export enum MidiInstrumentNumber {
  // 1. Piano
  AcousticGrandPiano = 0,
  BrightAcousticPiano = 1,
  ElectricGrandPiano = 2,
  HonkyTonkPiano = 3,
  ElectricPiano1 = 4, // Rhodes
  ElectricPiano2 = 5,
  Harpsichord = 6,
  Clavinet = 7,

  // 2. Chromatic Percussion
  Celesta = 8,
  Glockenspiel = 9,
  MusicBox = 10,
  Vibraphone = 11,
  Marimba = 12,
  Xylophone = 13,
  TubularBells = 14,
  Dulcimer = 15,

  // 3. Organ
  DrawbarOrgan = 16,
  PercussiveOrgan = 17,
  RockOrgan = 18,
  ChurchOrgan = 19,
  ReedOrgan = 20,
  Accordion = 21,
  Harmonica = 22,
  TangoAccordion = 23,

  // 4. Guitar
  AcousticGuitarNylon = 24,
  AcousticGuitarSteel = 25,
  ElectricGuitarJazz = 26,
  ElectricGuitarClean = 27,
  ElectricGuitarMuted = 28,
  OverdrivenGuitar = 29,
  DistortionGuitar = 30,
  GuitarHarmonics = 31,

  // 5. Bass
  AcousticBass = 32,
  ElectricBassFinger = 33,
  ElectricBassPick = 34,
  FretlessBass = 35,
  SlapBass1 = 36,
  SlapBass2 = 37,
  SynthBass1 = 38,
  SynthBass2 = 39,

  // 6. Strings
  Violin = 40,
  Viola = 41,
  Cello = 42,
  Contrabass = 43,
  TremoloStrings = 44,
  PizzicatoStrings = 45,
  OrchestralHarp = 46,
  Timpani = 47,

  // 7. Ensemble
  StringEnsemble1 = 48,
  StringEnsemble2 = 49,
  SynthStrings1 = 50,
  SynthStrings2 = 51,
  ChoirAahs = 52,
  VoiceOohs = 53,
  SynthVoice = 54,
  OrchestraHit = 55,

  // 8. Brass
  Trumpet = 56,
  Trombone = 57,
  Tuba = 58,
  MutedTrumpet = 59,
  FrenchHorn = 60,
  BrassSection = 61,
  SynthBrass1 = 62,
  SynthBrass2 = 63,

  // 9. Reed
  SopranoSax = 64,
  AltoSax = 65,
  TenorSax = 66,
  BaritoneSax = 67,
  Oboe = 68,
  EnglishHorn = 69,
  Bassoon = 70,
  Clarinet = 71,

  // 10. Pipe
  Piccolo = 72,
  Flute = 73,
  Recorder = 74,
  PanFlute = 75,
  BlownBottle = 76,
  Shakuhachi = 77,
  Whistle = 78,
  Ocarina = 79,

  // 11. Synth Lead
  LeadSquare = 80,
  LeadSawtooth = 81,
  LeadCalliope = 82,
  LeadChiff = 83,
  LeadCharang = 84,
  LeadVoice = 85,
  LeadFifths = 86,
  LeadBass = 87,

  // 12. Synth Pad
  PadNewAge = 88,
  PadWarm = 89,
  PadPolysynth = 90,
  PadChoir = 91,
  PadBowed = 92,
  PadMetallic = 93,
  PadHalo = 94,
  PadSweep = 95,

  // 13. Synth Effects
  FxRain = 96,
  FxSoundtrack = 97,
  FxCrystal = 98,
  FxAtmosphere = 99,
  FxBrightness = 100,
  FxGoblins = 101,
  FxEchoes = 102,
  FxSciFi = 103,

  // 14. Ethnic
  Sitar = 104,
  Banjo = 105,
  Shamisen = 106,
  Koto = 107,
  Kalimba = 108,
  Bagpipe = 109,
  Fiddle = 110,
  Shanai = 111,

  // 15. Percussive
  TinkleBell = 112,
  Agogo = 113,
  SteelDrums = 114,
  Woodblock = 115,
  TaikoDrum = 116,
  MelodicTom = 117,
  SynthDrum = 118,
  ReverseCymbal = 119,

  // 16. Sound Effects
  GuitarFretNoise = 120,
  BreathNoise = 121,
  Seashore = 122,
  BirdTweet = 123,
  TelephoneRing = 124,
  Helicopter = 125,
  Applause = 126,
  Gunshot = 127,

  Percussions = 128,
}

export enum MidiInstrumentFamily {
  Piano = "piano",
  ChromaticPercussion = "chromatic percussion",
  Organ = "organ",
  Guitar = "guitar",
  Bass = "bass",
  Strings = "strings",
  Ensemble = "ensemble",
  Brass = "brass",
  Reed = "reed",
  Pipe = "pipe",
  SynthLead = "synth lead",
  SynthPad = "synth pad",
  SynthEffects = "synth effects",
  Ethnic = "ethnic",
  Percussive = "percussive",
  SoundEffects = "sound effects",
}

export function getFamilyFromInstrumentNumber(instrumentNumber: number): MidiInstrumentFamily {
  const families = Object.values(MidiInstrumentFamily);
  const familyIndex = Math.floor(instrumentNumber / 8);

  return families[familyIndex] || MidiInstrumentFamily.Piano;
}
