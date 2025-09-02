// Middleware to protect routes: 
// Checks if the user is authenticated using Clerk. 
// If not authenticated, returns a 401 Unauthorized response; otherwise, proceeds to the next middleware or route handler.
export const protectRoute = async (req, res, next) => {
  if (!req.auth().isAuthenticated) {
    return res.status(401).json({ message: "Unauthorized - you must be logged in" });
  }
  next();
};
