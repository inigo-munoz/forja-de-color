describe('test environment', () => {
  it('runs arithmetic', () => {
    expect(1 + 1).toBe(2);
  });

  it('provides a DOM', () => {
    expect(document).toBeDefined();
  });
});
