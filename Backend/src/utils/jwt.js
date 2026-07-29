import jwt from 'jsonwebtoken';
import env from '../config/env.js';

export const generateToken = (userId) => {

  return jwt.sign(

    {
      id: userId
    },

    env.jwtSecret,

    {
      expiresIn: env.jwtExpiresIn
    }

  );

};




export const verifyToken = (token) => {
  return jwt.verify(
    token,
    env.jwtSecret
  );
};