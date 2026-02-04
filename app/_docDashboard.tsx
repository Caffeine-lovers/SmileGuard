import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

export default function DoctorDashboard() {
  return (
    <SafeAreaProvider>
        <SafeAreaView style={{flex: 1}}>
            <ScrollView>
                <View style={styles.Container}>
                    <Text style={[styles.Header, {marginBottom: 5}]}>Welcome to Smile Guard</Text>

                    <View style={styles.FirstPanel}>
                        <View style={[styles.Panel, {marginRight: 10}]}>
                            <Text style={styles.Text}>
                                Patients{"\n"}
                                67
                            </Text>
                        </View>

                        <View style={[styles.Panel, {marginRight: 10}]}>
                            <Text style={styles.Text}>
                                Appointments{"\n"}
                                21
                            </Text>
                        </View>

                        <View style={styles.Panel}>
                            <Text style={styles.Text}>
                                Treatments{"\n"}
                                911
                            </Text>
                        </View>
                    </View>

                    <View>
                        <Text style={[styles.Header, {
                            marginTop: 20, 
                            marginBottom: 5,
                            flexDirection: "row",
                            }]}>
                                Quick Actions
                            </Text>

                        {/* Today's Appointments Section */}
                        <View style={{flexDirection: "row"}}>
                            <View style={[styles.InviPanel, {
                                flexDirection: "column",
                            }]}>
                                <Text>Today Appointments:</Text>
                                 <View style={[styles.InsidePanel, {
                                    flexDirection: "row",
                                }]}>
                                    <TouchableOpacity 
                                        style={[styles.ProfileBtn, {
                                            flexDirection: "row",
                                        }]}
                                        onPress={() => window.alert("You pressed the button!")}
                                    >
                                        <Image 
                                            source={require("../assets/images/user.png")}
                                            style={styles.Icon}
                                        />
                                        <View style={{flex: 1, justifyContent: "center"}}>
                                            <Text>Mart Emman</Text>
                                            <Text>Whitening</Text>
                                        </View>

                                        <Text style={{alignContent: "center", marginRight: 3}}>
                                            10:00
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                 <View style={[styles.InsidePanel, {
                                    flexDirection: "row",
                                }]}>
                                    <TouchableOpacity 
                                        style={[styles.ProfileBtn, {
                                            flexDirection: "row",
                                        }]}
                                        onPress={() => window.alert("You pressed the button!")}
                                    >
                                        <Image 
                                            source={require("../assets/images/user.png")}
                                            style={styles.Icon}
                                        />
                                        <View style={{flex: 1, justifyContent: "center"}}>
                                            <Text>Jendri Jacin</Text>
                                            <Text>Aligners</Text>
                                        </View>

                                        <Text style={{alignContent: "center", marginRight: 3}}>
                                            13:00
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                 <View style={[styles.InsidePanel, {
                                    flexDirection: "row",
                                }]}>
                                    <TouchableOpacity 
                                        style={[styles.ProfileBtn, {
                                            flexDirection: "row",
                                        }]}
                                        onPress={() => window.alert("You pressed the button!")}
                                    >
                                        <Image 
                                            source={require("../assets/images/user.png")}
                                            style={styles.Icon}
                                        />
                                        <View style={{flex: 1, justifyContent: "center"}}>
                                            <Text>Kyler Per</Text>
                                            <Text>Root Canals</Text>
                                        </View>

                                        <Text style={{alignContent: "center", marginRight: 3}}>
                                            15:00
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                 <View style={[styles.InsidePanel, {
                                    flexDirection: "row",
                                }]}>
                                    <TouchableOpacity 
                                        style={[styles.ProfileBtn, {
                                            flexDirection: "row",
                                        }]}
                                        onPress={() => window.alert("You pressed the button!")}
                                    >
                                        <Image 
                                            source={require("../assets/images/user.png")}
                                            style={styles.Icon}
                                        />
                                        <View style={{flex: 1, justifyContent: "center"}}>
                                            <Text>Marie Yan</Text>
                                            <Text>Extractions</Text>
                                        </View>

                                        <Text style={{alignContent: "center", marginRight: 3}}>
                                            18:00
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Next Patient Details Section */}
                            <View style={[styles.InviPanel, {
                                marginLeft: 20
                            }]}>
                                <Text>Next Patients Details:</Text>
                                <View style={[styles.InsidePanel, {
                                    width: 250,
                                    height: "87%",
                                    justifyContent: "center",
                                    alignItems: "center"
                                }]}>
                                    <Text style={{textAlign: "center"}}>
                                        Patient Name: Mart Emman{"\n"}
                                        .some details.
                                    </Text>
                                </View>
                            </View>
                        </View>

                        {/* Appointment Requests Section */}
                        <View style={{flexDirection: "row"}}>
                            <View style={[styles.InviPanel, {
                                flexDirection: "column",
                                marginTop: 15,
                                marginBottom: 30,
                            }]}>
                                <Text>Appointment Requests:</Text>
                                <View style={[styles.InsidePanel, {
                                    flexDirection: "row",
                                }]}>
                                    <View 
                                        style={[styles.ProfileBtn, {
                                            flexDirection: "row",
                                        }]}
                                    >
                                        <Image 
                                            source={require("../assets/images/user.png")}
                                            style={styles.Icon}
                                        />
                                        <View style={{flex: 1}}>
                                            <Text>Mart Emman</Text>
                                            <Text>Cleaning</Text>
                                            <Text>2 February • 10:00</Text>
                                        </View>

                                        <Image 
                                            source={require("../assets/images/yes.png")}
                                            style={styles.YesNoBtn}
                                        />
                                        <Image 
                                            source={require("../assets/images/no.png")}
                                            style={styles.YesNoBtn}
                                        />
                                    </View>
                                </View>

                                <View style={[styles.InsidePanel, {
                                    flexDirection: "row",
                                }]}>
                                    <View
                                        style={[styles.ProfileBtn, {
                                            flexDirection: "row",
                                        }]}
                                    >
                                        <Image 
                                            source={require("../assets/images/user.png")}
                                            style={styles.Icon}
                                        />
                                        <View style={{flex: 1}}>
                                            <Text>Jendri Jacin</Text>
                                            <Text>Fllings</Text>
                                            <Text>4 February • 11:00</Text>
                                        </View>

                                        <Image 
                                            source={require("../assets/images/yes.png")}
                                            style={styles.YesNoBtn}
                                        />
                                        <Image 
                                            source={require("../assets/images/no.png")}
                                            style={styles.YesNoBtn}
                                        />
                                    </View>
                                </View>

                                 <View style={[styles.InsidePanel, {
                                    flexDirection: "row",
                                }]}>
                                    <View
                                        style={[styles.ProfileBtn, {
                                            flexDirection: "row",
                                        }]}
                                    >
                                        <Image 
                                            source={require("../assets/images/user.png")}
                                            style={styles.Icon}
                                        />
                                        <View style={{flex: 1}}>
                                            <Text>Kyler Per</Text>
                                            <Text>Veneers</Text>
                                            <Text>6 February • 9:00</Text>
                                        </View>

                                        <Image 
                                            source={require("../assets/images/yes.png")}
                                            style={styles.YesNoBtn}
                                        />
                                        <Image 
                                            source={require("../assets/images/no.png")}
                                            style={styles.YesNoBtn}
                                        />
                                    </View>
                                </View>

                                 <View style={[styles.InsidePanel, {
                                    flexDirection: "row",
                                }]}>
                                    <View
                                        style={[styles.ProfileBtn, {
                                            flexDirection: "row",
                                        }]}
                                    >
                                        <Image 
                                            source={require("../assets/images/user.png")}
                                            style={styles.Icon}
                                        />
                                        <View style={{flex: 1}}>
                                            <Text>Marie Yan</Text>
                                            <Text>Whitening</Text>
                                            <Text>8 February • 13:00</Text>
                                        </View>

                                        <Image 
                                            source={require("../assets/images/yes.png")}
                                            style={styles.YesNoBtn}
                                        />
                                        <Image 
                                            source={require("../assets/images/no.png")}
                                            style={styles.YesNoBtn}
                                        />
                                    </View>
                                </View>
                            </View>
                        </View>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  Container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f7fb",
  },
  Header: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#0b7fab",
    textAlign: "center",
  },
  Text: {
    fontSize: 18,
    textAlign: "center",
  },
  FirstPanel: {
    flexDirection: "row",
    flex: 1,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderEndWidth: 2,
    borderBottomWidth: 2,
    borderColor: "#000000",
    borderRadius: 10,
    padding: 20,
    elevation: 5,             // shadow on Android
    shadowColor: "#000",      // shadow on iOS
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  Panel: {
    backgroundColor: "#ffffff",
    width: 200,
    height: 200,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
  },
  InviPanel: {
    backgroundColor: "#ffffff", // Invisible panel for layout purposes
    /*width: 200,
    height: 200,*/
    padding: 10,
    borderRadius: 10,
  },
  InsidePanel: {
    backgroundColor: "#7878781f",
    marginTop: 5,
    borderRadius: 10,
  },
  ProfileBtn: {
    width: 300,
    padding: 3,
    backgroundColor: "#A594F9",
  },
  Icon: {
    width: 40,
    height: 40,
    alignSelf: "center",
    resizeMode: "contain",
    marginRight: 5,
    marginLeft: 5,
    marginTop: 2,
    marginBottom: 2,
  },
  YesNoBtn: {
    resizeMode: "contain",
    width: 20,
    height: 20,
    alignSelf: "center",
    marginRight: 3,
  }
});
