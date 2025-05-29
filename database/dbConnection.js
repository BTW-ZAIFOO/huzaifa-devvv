import mongoose from "mongoose";

export const connection = () => {
  mongoose
    .connect("mongodb://0.0.0.0:27017/", {
      dbName: "aiChat",
    })
    .then(() => {
      console.log("Connected to database.");
    })
    .catch((err) => {
      console.log(`Some error occured while connecting to database: ${err}`);
    });
};