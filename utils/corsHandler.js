// Helper middleware to handle pre-flight OPTIONS requests properly
export const handleOptions = (req, res, next) => {
    if (req.method === 'OPTIONS') {
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        return res.status(200).json({});
    }
    next();
};
