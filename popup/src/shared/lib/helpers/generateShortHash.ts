export async function generateShortHash(input: string): Promise<string> {
  // Encode the input string into a Uint8Array (UTF-8)
  const encoder = new TextEncoder();
  const data = encoder.encode(input);

  // Compute the SHA-256 digest
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);

  // Create a DataView to read numeric values from the buffer
  const dataView = new DataView(hashBuffer);

  // Read the first 4 bytes as a 32-bit unsigned integer (big-endian)
  const val = dataView.getUint32(0, false);

  // Convert the integer to a base-36 string
  return val.toString(36);
}