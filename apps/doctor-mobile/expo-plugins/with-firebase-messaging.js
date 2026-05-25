const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function withFirebaseMessaging(config) {
  return withAppBuildGradle(config, (config) => {
    if (!config.modResults || typeof config.modResults !== 'string') {
      return config;
    }
    
    let contents = config.modResults;
    
    // Skip if Firebase already added
    if (contents.includes('firebase-messaging')) {
      return config;
    }
    
    // Find the dependencies block and add Firebase at the end
    const firebaseBlock = `    implementation platform('com.google.firebase:firebase-bom:34.13.0')\n    implementation('com.google.firebase:firebase-messaging')`;
    
    // Insert before the closing brace of the dependencies block
    contents = contents.replace(
      /^(dependencies\s*\{[\s\S]*?)(\n\})/m,
      `$1\n\n${firebaseBlock}$2`
    );
    
    config.modResults = contents;
    return config;
  });
};
