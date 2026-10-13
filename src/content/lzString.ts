// The base64 flavour of lz-string (compressToBase64 and its inverse),
// ported from lz-string 1.5.0 by pieroxy (MIT licence, copyright 2013
// pieroxy; credited in the README). It is the compression f-puzzles writes
// its ?load= links in and SudokuPad its scl… and fpuz… puzzle ids in
// (src/content/importLinks.ts). A faithful port of the two functions the
// app needs rather than the library as a dependency: nothing else in it is
// used, and a bundle a few kilobytes smaller matters on a phone. The
// compressor is here for the tests (and for links the app may one day
// write); the app's bundle tree-shakes it away while nothing imports it.
//
// The stream: 2 bits say what the first token is, then each token is a
// dictionary code of numBits bits, or 0/1 followed by a new character of
// 8 or 16 bits; numBits grows as the dictionary fills; 2 ends the stream.
// Bits are packed least significant first into 6-bit base64 characters.

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
const BITS_PER_CHAR = 6;

/** a string as lz-string's compressToBase64 writes it, padded to a multiple of four characters */
export function compressToBase64(input: string): string {
  const dictionary = new Map<string, number>();
  const toCreate = new Set<string>();
  const out: string[] = [];
  let w = '';
  let enlargeIn = 2;
  let dictSize = 3;
  let numBits = 2;
  let val = 0;
  let position = 0;
  const write = (bits: number, value: number) => {
    for (let i = 0; i < bits; i++) {
      val = (val << 1) | (value & 1);
      if (position === BITS_PER_CHAR - 1) {
        position = 0;
        out.push(ALPHABET[val]);
        val = 0;
      } else position++;
      value >>= 1;
    }
  };
  const grow = () => {
    if (--enlargeIn === 0) {
      enlargeIn = 2 ** numBits;
      numBits++;
    }
  };
  const emit = () => {
    if (toCreate.has(w)) {
      const code = w.charCodeAt(0);
      if (code < 256) {
        write(numBits, 0);
        write(8, code);
      } else {
        write(numBits, 1);
        write(16, code);
      }
      grow();
      toCreate.delete(w);
    } else write(numBits, dictionary.get(w)!);
    grow();
  };
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (!dictionary.has(c)) {
      dictionary.set(c, dictSize++);
      toCreate.add(c);
    }
    const wc = w + c;
    if (dictionary.has(wc)) w = wc;
    else {
      emit();
      dictionary.set(wc, dictSize++);
      w = c;
    }
  }
  if (w !== '') emit();
  write(numBits, 2);
  for (;;) {
    val <<= 1;
    if (position === BITS_PER_CHAR - 1) {
      out.push(ALPHABET[val]);
      break;
    }
    position++;
  }
  const res = out.join('');
  return res + '==='.slice(0, (4 - (res.length % 4)) % 4);
}

/**
 * The string a compressToBase64 output stands for; null for an empty
 * input, a character outside base64 or a stream that does not decode
 * (lz-string returns null for the last and "" for some truncations; both
 * are failures to the caller, who expects JSON)
 */
export function decompressFromBase64(input: string): string | null {
  if (input === '') return null;
  const codes = new Uint8Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const v = ALPHABET.indexOf(input[i]);
    if (v < 0) return null;
    codes[i] = v;
  }
  return decompress(codes, 32);
}

function decompress(codes: Uint8Array, resetValue: number): string | null {
  const dictionary: string[] = [];
  let enlargeIn = 4;
  let dictSize = 4;
  let numBits = 3;
  let val = codes[0];
  let position = resetValue;
  let index = 1;
  const read = (bits: number): number => {
    let result = 0;
    for (let power = 1, max = 2 ** bits; power !== max; power <<= 1) {
      const resb = val & position;
      position >>= 1;
      if (position === 0) {
        position = resetValue;
        val = index < codes.length ? codes[index] : 0;
        index++;
      }
      if (resb > 0) result |= power;
    }
    return result;
  };
  const char = (bits: number) => String.fromCharCode(read(bits));
  let c: string;
  switch (read(2)) {
    case 0:
      c = char(8);
      break;
    case 1:
      c = char(16);
      break;
    case 2:
      return '';
    default:
      return null;
  }
  dictionary[3] = c;
  let w = c;
  const result = [c];
  for (;;) {
    if (index > codes.length) return '';
    let code = read(numBits);
    switch (code) {
      case 0:
        dictionary[dictSize++] = char(8);
        code = dictSize - 1;
        enlargeIn--;
        break;
      case 1:
        dictionary[dictSize++] = char(16);
        code = dictSize - 1;
        enlargeIn--;
        break;
      case 2:
        return result.join('');
    }
    if (enlargeIn === 0) {
      enlargeIn = 2 ** numBits;
      numBits++;
    }
    let entry: string;
    if (dictionary[code]) entry = dictionary[code];
    else if (code === dictSize) entry = w + w.charAt(0);
    else return null;
    result.push(entry);
    dictionary[dictSize++] = w + entry.charAt(0);
    enlargeIn--;
    w = entry;
    if (enlargeIn === 0) {
      enlargeIn = 2 ** numBits;
      numBits++;
    }
  }
}
