/**
 * @assistigo/form-engine — field detection contract, safety rules, mapping and transforms.
 *
 * Shared by the API (which produces mapping proposals) and the Chrome extension (which detects
 * fields and applies fills). Nothing here touches the DOM or the network.
 */

export * from './types';
export * from './safety';
export * from './dictionary';
export * from './scorer';
export * from './transforms';
export * from './adapters';
export * from './adapter-registry';
export * from './mapper';
