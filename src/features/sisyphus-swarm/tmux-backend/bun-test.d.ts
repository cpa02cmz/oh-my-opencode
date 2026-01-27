declare module "bun:test" {
  type TestCallback = () => void | Promise<void>

  interface Expectation {
    toBe(expected: unknown): void
    toContain(expected: string): void
  }

  type Expect = (value: unknown) => Expectation

  interface Spy {
    mockImplementation(implementation: (...args: unknown[]) => unknown): Spy
    mockRestore(): void
  }

  export function describe(name: string, callback: TestCallback): void
  export function it(name: string, callback: TestCallback): void
  export function beforeEach(callback: TestCallback): void
  export function afterEach(callback: TestCallback): void
  export function mock(implementation?: (...args: unknown[]) => unknown): (...args: unknown[]) => unknown
  export function spyOn(target: object, method: string): Spy
  export const expect: Expect
}

declare const Bun: {
  spawnSync(
    command: string[],
    options: { stdout: "pipe"; stderr: "pipe" }
  ): { exitCode: number }
}
