import type { Paint, PaintType } from './paint';
import { analogous, complementary, kindOf, placeOnWheel, triad, wheelColourOf } from './wheel';

const paint = (code: string, hex: string, type: PaintType = 'opaque'): Paint => ({
  brand: 'Vallejo', code, name: code, range: 'Model Color', type, hex,
});

describe('colour wheel', () => {
  it("places pure colours on the painter's RYB wheel", () => {
    expect(wheelColourOf('#ff0000')).toBe('red');
    expect(wheelColourOf('#ff8000')).toBe('orange');
    expect(wheelColourOf('#ffff00')).toBe('yellow');
    expect(wheelColourOf('#00ff00')).toBe('green');
    expect(wheelColourOf('#0000ff')).toBe('blue');
    expect(wheelColourOf('#8000ff')).toBe('violet');
    expect(wheelColourOf('#FF4000')).toBe('red-orange');
    expect(wheelColourOf('#80ff00')).toBe('yellow-green');
  });

  it.each(['#808080', '#000000', '#ffffff', '#1a1a1a', '#7a7570', 'red', ''])(
    'greys, black, white and unreadable colours have no place on the wheel: %s',
    (hex) => expect(wheelColourOf(hex)).toBeNull(),
  );

  it('harmonies follow the wheel - opposite, neighbours and triad', () => {
    expect(complementary('red')).toBe('green');
    expect(analogous('red')).toEqual(['red-violet', 'red-orange']);
    expect(triad('red')).toEqual(['yellow', 'blue']);
    expect(complementary('yellow')).toBe('violet');
    expect(complementary('blue')).toBe('orange');
    expect(analogous('red-violet')).toEqual(['violet', 'red']);
  });

  it('each colour knows if it is primary, secondary or tertiary', () => {
    expect(kindOf('blue')).toBe('primary');
    expect(kindOf('green')).toBe('secondary');
    expect(kindOf('blue-green')).toBe('tertiary');
  });

  it("sorts the user's paints by colour, neutrals and metallics apart, mediums left out", () => {
    const red = paint('70.926', '#b01c1c');
    const wash = paint('73.200', '#c81e1e', 'wash');
    const green = paint('70.890', '#2e6b2e');
    const black = paint('70.950', '#141414');
    const gold = paint('70.996', '#d4af37', 'metallic');
    const medium = paint('70.470', '#ffffff', 'medium');

    const wheel = placeOnWheel([red, green, black, gold, medium, wash]);

    expect(wheel.paintsOf('red')).toEqual([red, wash]);
    expect(wheel.paintsOf('green')).toEqual([green]);
    expect(wheel.paintsOf('blue')).toEqual([]);
    expect(wheel.neutrals).toEqual([black, gold]);
  });
});
