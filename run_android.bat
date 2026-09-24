@echo off
set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk
set ANDROID_SDK_ROOT=%LOCALAPPDATA%\Android\Sdk
set JAVA_HOME=C:\Program Files\Common Files\Oracle\Java\javapath
set PATH=%PATH%;%LOCALAPPDATA%\Android\Sdk\platform-tools;%LOCALAPPDATA%\Android\Sdk\tools
cd apps\doctor-mobile
pnpm run android

