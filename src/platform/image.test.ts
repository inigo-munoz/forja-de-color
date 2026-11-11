import { targetSize } from './image';

describe('targetSize', () => {
  it('scales a 4000×3000 photo to 1600×1200', () => {
    expect(targetSize(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
  });

  it('scales a portrait photo by its longer side', () => {
    expect(targetSize(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  it('never upscales a small image', () => {
    expect(targetSize(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });
});
