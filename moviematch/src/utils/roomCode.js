// Genereert korte, makkelijk te delen/uit te spreken codes.
// Alfabet zonder verwarrende tekens (0/O, 1/I/L).
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function generateRoomCode(length = 6) {
  let code = ''
  for (let i = 0; i < length; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  }
  return code
}
