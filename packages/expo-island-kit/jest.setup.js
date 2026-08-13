// Force Expo's lazily-installed `fetch` global to initialise inside the test lifecycle.
//
// SDK 57's jest-expo preset installs `fetch` as a lazy getter (expo/src/winter/installGlobal).
// The first access requires `expo-modules-core`, which has no native module under Jest and
// emits `An error occurred while requiring the 'ExpoModulesCoreJSLogger' module`. If nothing
// touches `fetch` until Jest is tearing down, that warning lands after the run has finished —
// Jest reports "Cannot log after tests are done" and exits 1 even though every test passed.
//
// Touching it here makes the warning happen at a legal point instead. This is a workaround for
// a jest-expo/expo-modules-core interaction, not for anything in IslandKit: none of our tests
// use fetch. Revisit when jest-expo stops eagerly wiring the winter runtime into the preset.
void globalThis.fetch;
