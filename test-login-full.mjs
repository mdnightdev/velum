import fs from 'fs';

const go = async () => {
  // 1. Get salt
  const saltRes = await fetch('http://localhost:3000/api/auth/login-salt?username=lexie');
  const { salt } = await saltRes.json();
  
  // 2. Get nonce
  const nonceRes = await fetch('http://localhost:3000/api/auth/login-nonce');
  const { nonce } = await nonceRes.json();
  
  console.log({ salt, nonce });
  
  // For Lexie, the permanent OTP is... wait, I don't know it!
};
go();
