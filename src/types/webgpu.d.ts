// Minimal, strict WebGPU type definitions for vanilla TypeScript without external @webgpu/types dependency

type GPUFlagsConstant = number;
type GPUSize32 = number;
type GPUSize64 = number;
type GPUIndex32 = number;

interface GPUColorDict {
  r: number;
  g: number;
  b: number;
  a: number;
}
type GPUColor = Iterable<number> | GPUColorDict;

type GPUTextureFormat =
  | 'bgra8unorm'
  | 'rgba8unorm'
  | 'rgba8unorm-srgb'
  | 'depth24plus'
  | 'depth24plus-stencil8'
  | 'depth32float';

type GPUPrimitiveTopology =
  | 'point-list'
  | 'line-list'
  | 'line-strip'
  | 'triangle-list'
  | 'triangle-strip';

type GPUCullMode = 'none' | 'front' | 'back';
type GPUFrontFace = 'ccw' | 'cw';
type GPUCompareFunction =
  | 'never'
  | 'less'
  | 'equal'
  | 'less-equal'
  | 'greater'
  | 'not-equal'
  | 'greater-equal'
  | 'always';

type GPUVertexFormat =
  | 'float32'
  | 'float32x2'
  | 'float32x3'
  | 'float32x4'
  | 'uint32'
  | 'sint32';

type GPUVertexStepMode = 'vertex' | 'instance';

type GPUFilterMode = 'nearest' | 'linear';
type GPUMipmapFilterMode = 'nearest' | 'linear';
type GPUAddressMode = 'clamp-to-edge' | 'repeat' | 'mirror-repeat';

type GPULoadOp = 'load' | 'clear';
type GPUStoreOp = 'store' | 'discard';

type GPUBlendFactor =
  | 'zero'
  | 'one'
  | 'src'
  | 'one-minus-src'
  | 'src-alpha'
  | 'one-minus-src-alpha'
  | 'dst'
  | 'one-minus-dst'
  | 'dst-alpha'
  | 'one-minus-dst-alpha';

type GPUBlendOperation = 'add' | 'subtract' | 'reverse-subtract' | 'min' | 'max';

interface GPUBlendComponent {
  operation?: GPUBlendOperation;
  srcFactor?: GPUBlendFactor;
  dstFactor?: GPUBlendFactor;
}

interface GPUBlendState {
  color: GPUBlendComponent;
  alpha: GPUBlendComponent;
}

interface GPUVertexAttribute {
  format: GPUVertexFormat;
  offset: GPUSize64;
  shaderLocation: GPUIndex32;
}

interface GPUVertexBufferLayout {
  arrayStride: GPUSize64;
  stepMode?: GPUVertexStepMode;
  attributes: Iterable<GPUVertexAttribute>;
}

interface GPUShaderModuleDescriptor {
  label?: string;
  code: string;
}

interface GPUShaderModule {}

interface GPUProgrammableStage {
  module: GPUShaderModule;
  entryPoint?: string;
}

interface GPUVertexState extends GPUProgrammableStage {
  buffers?: Iterable<GPUVertexBufferLayout | null>;
}

interface GPUColorTargetState {
  format: GPUTextureFormat;
  blend?: GPUBlendState;
  writeMask?: GPUFlagsConstant;
}

interface GPUFragmentState extends GPUProgrammableStage {
  targets: Iterable<GPUColorTargetState | null>;
}

interface GPUPrimitiveState {
  topology?: GPUPrimitiveTopology;
  cullMode?: GPUCullMode;
  frontFace?: GPUFrontFace;
}

interface GPUDepthStencilState {
  format: GPUTextureFormat;
  depthWriteEnabled?: boolean;
  depthCompare?: GPUCompareFunction;
  depthBias?: number;
  depthBiasSlopeScale?: number;
  depthBiasClamp?: number;
}

interface GPUMultisampleState {
  count?: GPUSize32;
  mask?: GPUSize32;
  alphaToCoverageEnabled?: boolean;
}

interface GPUBindGroupLayoutEntry {
  binding: GPUIndex32;
  visibility: GPUFlagsConstant;
  buffer?: {
    type?: 'uniform' | 'storage' | 'read-only-storage';
    hasDynamicOffset?: boolean;
    minBindingSize?: GPUSize64;
  };
  sampler?: {
    type?: 'filtering' | 'non-filtering' | 'comparison';
  };
  texture?: {
    sampleType?: 'float' | 'unfilterable-float' | 'depth' | 'sint' | 'uint';
    viewDimension?: '1d' | '2d' | '2d-array' | 'cube' | 'cube-array' | '3d';
    multisampled?: boolean;
  };
}

interface GPUBindGroupLayoutDescriptor {
  label?: string;
  entries: Iterable<GPUBindGroupLayoutEntry>;
}

interface GPUBindGroupLayout {}

interface GPUPipelineLayoutDescriptor {
  label?: string;
  bindGroupLayouts: Iterable<GPUBindGroupLayout>;
}

interface GPUPipelineLayout {}

interface GPURenderPipelineDescriptor {
  label?: string;
  layout: GPUPipelineLayout | 'auto';
  vertex: GPUVertexState;
  fragment?: GPUFragmentState;
  primitive?: GPUPrimitiveState;
  depthStencil?: GPUDepthStencilState;
  multisample?: GPUMultisampleState;
}

interface GPURenderPipeline {
  getBindGroupLayout(index: number): GPUBindGroupLayout;
}

interface GPUBufferDescriptor {
  label?: string;
  size: GPUSize64;
  usage: GPUFlagsConstant;
  mappedAtCreation?: boolean;
}

interface GPUBuffer {
  getMappedRange(offset?: GPUSize64, size?: GPUSize64): ArrayBuffer;
  unmap(): void;
  destroy(): void;
}

interface GPUExtent3DDict {
  width: GPUSize32;
  height?: GPUSize32;
  depthOrArrayLayers?: GPUSize32;
}
type GPUExtent3D = Iterable<GPUSize32> | GPUExtent3DDict;

interface GPUTextureDescriptor {
  label?: string;
  size: GPUExtent3D;
  mipLevelCount?: GPUSize32;
  sampleCount?: GPUSize32;
  dimension?: '1d' | '2d' | '3d';
  format: GPUTextureFormat;
  usage: GPUFlagsConstant;
}

interface GPUTextureView {}

interface GPUTexture {
  createView(descriptor?: Record<string, unknown>): GPUTextureView;
  destroy(): void;
}

interface GPUSamplerDescriptor {
  label?: string;
  addressModeU?: GPUAddressMode;
  addressModeV?: GPUAddressMode;
  addressModeW?: GPUAddressMode;
  magFilter?: GPUFilterMode;
  minFilter?: GPUFilterMode;
  mipmapFilter?: GPUMipmapFilterMode;
  maxAnisotropy?: number;
}

interface GPUSampler {}

interface GPUBufferBinding {
  buffer: GPUBuffer;
  offset?: GPUSize64;
  size?: GPUSize64;
}

type GPUBindingResource = GPUSampler | GPUTextureView | GPUBufferBinding;

interface GPUBindGroupEntry {
  binding: GPUIndex32;
  resource: GPUBindingResource;
}

interface GPUBindGroupDescriptor {
  label?: string;
  layout: GPUBindGroupLayout;
  entries: Iterable<GPUBindGroupEntry>;
}

interface GPUBindGroup {}

interface GPURenderPassColorAttachment {
  view: GPUTextureView;
  resolveTarget?: GPUTextureView;
  clearValue?: GPUColor;
  loadOp: GPULoadOp;
  storeOp: GPUStoreOp;
}

interface GPURenderPassDepthStencilAttachment {
  view: GPUTextureView;
  depthClearValue?: number;
  depthLoadOp?: GPULoadOp;
  depthStoreOp?: GPUStoreOp;
}

interface GPURenderPassDescriptor {
  label?: string;
  colorAttachments: Iterable<GPURenderPassColorAttachment | null>;
  depthStencilAttachment?: GPURenderPassDepthStencilAttachment;
}

interface GPURenderPassEncoder {
  setPipeline(pipeline: GPURenderPipeline): void;
  setBindGroup(index: GPUIndex32, bindGroup: GPUBindGroup): void;
  setVertexBuffer(slot: GPUIndex32, buffer: GPUBuffer | null, offset?: GPUSize64, size?: GPUSize64): void;
  setIndexBuffer(buffer: GPUBuffer, indexFormat: 'uint16' | 'uint32', offset?: GPUSize64, size?: GPUSize64): void;
  draw(vertexCount: GPUSize32, instanceCount?: GPUSize32, firstVertex?: GPUSize32, firstInstance?: GPUSize32): void;
  drawIndexed(indexCount: GPUSize32, instanceCount?: GPUSize32, firstIndex?: GPUSize32, baseVertex?: number, firstInstance?: GPUSize32): void;
  end(): void;
}

interface GPUCommandBuffer {}

interface GPUCommandEncoder {
  beginRenderPass(descriptor: GPURenderPassDescriptor): GPURenderPassEncoder;
  finish(): GPUCommandBuffer;
}

interface GPUImageCopyTexture {
  texture: GPUTexture;
  mipLevel?: GPUSize32;
  origin?: { x?: number; y?: number; z?: number };
}

interface GPUImageDataLayout {
  offset?: GPUSize64;
  bytesPerRow?: GPUSize32;
  rowsPerImage?: GPUSize32;
}

interface GPUQueue {
  submit(commandBuffers: Iterable<GPUCommandBuffer>): void;
  writeBuffer(
    buffer: GPUBuffer,
    bufferOffset: GPUSize64,
    data: BufferSource | SharedArrayBuffer,
    dataOffset?: GPUSize64,
    size?: GPUSize64
  ): void;
  writeTexture(
    destination: GPUImageCopyTexture,
    data: BufferSource | SharedArrayBuffer,
    dataLayout: GPUImageDataLayout,
    size: GPUExtent3D
  ): void;
}

interface GPUDevice {
  readonly queue: GPUQueue;
  createBuffer(descriptor: GPUBufferDescriptor): GPUBuffer;
  createTexture(descriptor: GPUTextureDescriptor): GPUTexture;
  createSampler(descriptor?: GPUSamplerDescriptor): GPUSampler;
  createBindGroupLayout(descriptor: GPUBindGroupLayoutDescriptor): GPUBindGroupLayout;
  createPipelineLayout(descriptor: GPUPipelineLayoutDescriptor): GPUPipelineLayout;
  createBindGroup(descriptor: GPUBindGroupDescriptor): GPUBindGroup;
  createShaderModule(descriptor: GPUShaderModuleDescriptor): GPUShaderModule;
  createRenderPipeline(descriptor: GPURenderPipelineDescriptor): GPURenderPipeline;
  createCommandEncoder(descriptor?: { label?: string }): GPUCommandEncoder;
}

interface GPUAdapter {
  requestDevice(descriptor?: Record<string, unknown>): Promise<GPUDevice>;
}

interface GPUCanvasConfiguration {
  device: GPUDevice;
  format: GPUTextureFormat;
  alphaMode?: 'opaque' | 'premultiplied';
}

interface GPUCanvasContext {
  configure(configuration: GPUCanvasConfiguration): void;
  getCurrentTexture(): GPUTexture;
}

interface GPU {
  requestAdapter(options?: { powerPreference?: 'low-power' | 'high-performance' }): Promise<GPUAdapter | null>;
  getPreferredCanvasFormat(): GPUTextureFormat;
}

interface Navigator {
  readonly gpu?: GPU;
}

declare var GPUBufferUsage: {
  readonly MAP_READ: number;
  readonly MAP_WRITE: number;
  readonly COPY_SRC: number;
  readonly COPY_DST: number;
  readonly INDEX: number;
  readonly VERTEX: number;
  readonly UNIFORM: number;
  readonly STORAGE: number;
  readonly INDIRECT: number;
  readonly QUERY_RESOLVE: number;
};

declare var GPUTextureUsage: {
  readonly COPY_SRC: number;
  readonly COPY_DST: number;
  readonly TEXTURE_BINDING: number;
  readonly STORAGE_BINDING: number;
  readonly RENDER_ATTACHMENT: number;
};

declare var GPUShaderStage: {
  readonly VERTEX: number;
  readonly FRAGMENT: number;
  readonly COMPUTE: number;
};
