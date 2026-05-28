// No-op shim. iOS shows the native LaunchScreen.storyboard automatically and
// React Native hides it on first frame; nothing for JS to do here.
export const preventAutoHideAsync = async (): Promise<void> => {};
export const hideAsync = async (): Promise<void> => {};
