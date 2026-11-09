import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { LoadingManager, TextureLoader } from 'three';

export async function loadCharacter({ characterUrl, characterData, onStage } = {}) {
  const manager = new LoadingManager();
  let failedScheme = '', stage = characterData == null ? 'model_request' : 'model_bytes';
  manager.onError = url => { failedScheme = /^[a-z][a-z0-9+.-]*:/i.exec(url)?.[0] || 'relative'; };
  const loader = new GLTFLoader(manager).setMeshoptDecoder(MeshoptDecoder);
  try {
    onStage?.(stage);
    if (characterData == null) {
      if (!characterUrl) throw new Error('character_unconfigured');
      return await loader.loadAsync(characterUrl);
    }
    let bytes = characterData instanceof Blob ? await characterData.arrayBuffer() : characterData;
    if (ArrayBuffer.isView(bytes)) bytes = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength).slice().buffer;
    if (!(bytes instanceof ArrayBuffer)) throw new Error('character_data_invalid');
    stage = 'glb_parse';
    onStage?.(stage);
    loader.register(parser => {
      // Embedded desktop contexts can reject fetch(blob:) for both the model and
      // ImageBitmapLoader. Three's HTML image decoder avoids the second fetch.
      parser.textureLoader = new TextureLoader(manager)
        .setCrossOrigin(parser.options.crossOrigin)
        .setWithCredentials(parser.options.withCredentials)
        .setRequestHeader(parser.options.requestHeader);
      return { name: 'COMPANION_html_image_decoder' };
    });
    return await loader.parseAsync(bytes, '');
  } catch (cause) {
    const error = new Error(`[${stage}${failedScheme ? ', resource=' + failedScheme : ''}] ${cause.message || cause}`, { cause });
    error.name = cause.name || 'Error';
    throw error;
  }
}
