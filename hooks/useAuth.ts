import { useState } from "react";
import { User, CurrentUser, FormData } from "../types";

// Mock database - in production, this would be Firebase/MongoDB
const INITIAL_USERS: User[] = [
  {
    name: "Dr. Smith",
    email: "doctor@test.com",
    password: "password123",
    role: "doctor",
    service: "General",
  },
  {
    name: "John Doe",
    email: "patient@test.com",
    password: "password123",
    role: "patient",
    service: "Cleaning",
  },
];

export function useAuth() {
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  const login = async (
    email: string,
    password: string,
    role: "patient" | "doctor"
  ): Promise<CurrentUser> => {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Find user
    const foundUser = users.find(
      (u) =>
        u.email.toLowerCase() === email.toLowerCase() &&
        u.password === password
    );

    // Validate
    if (!foundUser) {
      throw new Error("Invalid email or password.");
    }
    if (foundUser.role !== role) {
      throw new Error(`This account is not registered as a ${role}.`);
    }

    // Success
    return {
      name: foundUser.name,
      email: foundUser.email,
      role: foundUser.role,
    };
  };

  const register = async (
    formData: FormData,
    role: "patient" | "doctor"
  ): Promise<CurrentUser> => {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Check if email exists
    const exists = users.find(
      (u) => u.email.toLowerCase() === formData.email.toLowerCase()
    );
    if (exists) {
      throw new Error("Email already registered. Please login.");
    }

    // Create new user
    const newUser: User = {
      name: formData.name,
      email: formData.email,
      password: formData.password,
      role: role,
      service: formData.service || "General",
    };

    // Save to "database"
    setUsers([...users, newUser]);

    // Return user data
    return {
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
    };
  };

  const logout = () => {
    setCurrentUser(null);
  };

  return {
    currentUser,
    setCurrentUser,
    login,
    register,
    logout,
  };
}
