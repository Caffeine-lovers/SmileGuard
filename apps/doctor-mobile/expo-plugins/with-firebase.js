const { withAppBuildGradle, withProjectBuildGradle } = require('@expo/config-plugins');

module.exports = function withFirebase(config) {
  // Add Firebase classpath to project-level build.gradle
  config = withProjectBuildGradle(config, ({ contents }) => {
    if (!contents.includes('google-services:')) {
      const newContents = contents.replace(
        /dependencies\s*\{/,
        `dependencies {
        classpath('com.google.gms:google-services:4.4.0')`
      );
      return { contents: newContents };
    }
    return { contents };
  });

  // Add Firebase dependencies and plugin to app-level build.gradle
  config = withAppBuildGradle(config, ({ contents }) => {
    // Add Firebase BoM and messaging to dependencies
    if (!contents.includes('firebase-messaging')) {
      const firebaseBlock = `
    implementation platform('com.google.firebase:firebase-bom:34.13.0')
    implementation ('com.google.firebase:firebase-messaging')`;
      
      let newContents = contents.replace(
        /implementation\("com\.facebook\.react:react-android"\)/,
        `implementation("com.facebook.react:react-android")${firebaseBlock}`
      );

      // Add apply plugin at the end if not present
      if (!newContents.includes("apply plugin: 'com.google.gms.google-services'")) {
        newContents += "\n\napply plugin: 'com.google.gms.google-services'";
      }

      return { contents: newContents };
    }
    return { contents };
  });

  return config;
};
