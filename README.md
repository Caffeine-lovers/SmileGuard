# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   Make sure you have `pnpm` installed. If you are having issues with `corepack`, install pnpm globally:
   ```bash
   npm install -g pnpm@9.0.0
   ```

   Then install the project dependencies:
   ```bash
   pnpm install
   ```

2. Start the dev servers

   **For Patient Web (Next.js):**
   ```bash
   pnpm patient:dev
   # Or directly if the above fails: pnpm -C apps/patient-web dev
   ```

   **For Doctor Mobile (Expo):**
   ```bash
   pnpm doctor:start
   # Or directly: pnpm -C apps/doctor-mobile start
   ```

   To run Doctor Mobile explicitly on Web, Android, or iOS:
   ```bash
   pnpm doctor:start --web
   pnpm doctor:android
   pnpm doctor:ios
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
