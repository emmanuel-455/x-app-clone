import asyncHandler from "express-async-handler"
import User from "../models/user.model.js";
import Notification from "../models/notification.model.js";
import { clerkClient } from "@clerk/express";

// @desc    Get user profile by username
// @route   GET /api/users/:username
// @access  Public
export const getUserProfile = asyncHandler(async (req, res) => {
    // Extract username from the URL parameters
    const { username } = req.params;

    // Search for a user in the database by username
    const user = await User.findOne({ username });

    // If no user is found, return a 404 error response
    if (!user) return res.status(404).json({ error: "User not found" });

    // If user exists, return user data with 200 OK status
    res.status(200).json({ user });
});

// @desc    Update the authenticated user's profile
// @route   PUT /api/users/profile
// @access  Private
export const updateProfile = asyncHandler(async (req, res) => {
    // Get the currently authenticated user's ID from Clerk
    const { userId } = getAuth(req);

    // Update the user's profile in the database and return the updated document
    const user = await User.findOneAndUpdate({ clerkId: userId }, req.body, { new: true });

    // If user doesn't exist, return a 404 error response
    if (!user) return res.status(404).json({ error: "User not found" });

    // Return the updated user profile
    res.status(200).json({ user });
});


export const syncUser = asyncHandler(async (req, res) => {
    // Get the currently authenticated user's ID from Clerk
    const { userId } = getAuth(req);

  // check if user already exists in mongodb
  const existingUser = await User.findOne({ clerkId: userId });

  //if it does exist, sign in or return the user
  if (existingUser) {
    return res.status(200).json({ user: existingUser, message: "User already exists" });
  }

  //if the user doesn't exist, create a user
  // create new user from Clerk data
  const clerkUser = await clerkClient.users.getUser(userId);

  const userData = {
    clerkId: userId,
    email: clerkUser.emailAddresses[0].emailAddress,
    firstName: clerkUser.firstName || "",
    lastName: clerkUser.lastName || "",
    username: clerkUser.emailAddresses[0].emailAddress.split("@")[0],
    profilePicture: clerkUser.imageUrl || "",
  };

  const user = await User.create(userData);

  res.status(201).json({ user, message: "User created successfully" });
});

export const getCurrentUser = asyncHandler(async (req, res) => {
  const { userId } = getAuth(req);
  const user = await User.findOne({ clerkId: userId });

  if (!user) return res.status(404).json({ error: "User not found" });

  res.status(200).json({ user });
});

export const followUser = asyncHandler(async (req, res) => {
  // Get the logged-in user's ID from Clerk authentication
  const { userId } = getAuth(req);

  // Get the target user's ID from the request URL parameters
  const { targetUserId } = req.params;

  // Prevent a user from following themselves
  if (userId === targetUserId) return res.status(400).json({ error: "You cannot follow yourself" });

  // Find the current logged-in user in the database using Clerk's userId
  const currentUser = await User.findOne({ clerkId: userId });

  // Find the target user (the one to be followed/unfollowed) using MongoDB _id
  const targetUser = await User.findById(targetUserId);

  // If either the current user or target user doesn't exist, return an error
  if (!currentUser || !targetUser) return res.status(404).json({ error: "User not found" });

  // Check if the current user is already following the target user
  const isFollowing = currentUser.following.includes(targetUserId);

  if (isFollowing) {
    // If already following → Unfollow the user
    await User.findByIdAndUpdate(currentUser._id, {
      $pull: { following: targetUserId }, // remove target user from current user's following list
    });
    await User.findByIdAndUpdate(targetUserId, {
      $pull: { followers: currentUser._id }, // remove current user from target user's followers list
    });
  } else {
    // If not following → Follow the user
    await User.findByIdAndUpdate(currentUser._id, {
      $push: { following: targetUserId }, // add target user to current user's following list
    });
    await User.findByIdAndUpdate(targetUserId, {
      $push: { followers: currentUser._id }, // add current user to target user's followers list
    });

    // Create a notification for the target user about the follow action
    await Notification.create({
      from: currentUser._id, // who is following
      to: targetUserId,      // who is being followed
      type: "follow",        // notification type
    });
  }

  // Send a success response based on whether the user was followed or unfollowed
  res.status(200).json({
    message: isFollowing ? "User unfollowed successfully" : "User followed successfully",
  });
});
