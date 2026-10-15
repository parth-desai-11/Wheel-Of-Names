let databasePromise;

function openDatabase() {
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open('wheel-of-names-images', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('images');
      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => { database.close(); databasePromise = undefined; };
        resolve(database);
      };
      request.onerror = () => { databasePromise = undefined; reject(request.error); };
      request.onblocked = () => { databasePromise = undefined; reject(new Error('Close other wheel tabs and try again.')); };
    });
  }
  return databasePromise;
}

async function imageTransaction(mode, operation) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('images', mode);
    const request = operation(transaction.objectStore('images'));
    transaction.oncomplete = () => resolve(request.result);
    transaction.onabort = () => reject(transaction.error || request.error || new Error('Could not save this image.'));
    transaction.onerror = () => reject(transaction.error || request.error);
  });
}

export const putImage = (id, blob) => imageTransaction('readwrite', store => store.put(blob, id));
export const getImage = id => imageTransaction('readonly', store => store.get(id));
export const deleteImage = id => imageTransaction('readwrite', store => store.delete(id));

export async function prepareImage(file) {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file, such as a JPG or PNG.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Choose an image smaller than 10 MB.');
  const source = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = source;
    try { await image.decode(); }
    catch { throw new Error('Could not open that image. Try a JPG, PNG, WebP, GIF, or SVG file.'); }
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('That image has no visible content.');
    const scale = Math.min(1, 800 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.85));
    if (!blob) throw new Error('Could not process that image. Try a different file.');
    return blob;
  } finally { URL.revokeObjectURL(source); }
}
