import { describe, it, expect } from "bun:test";
import { hasKeys, isValidData } from "../src/util";

describe("hasKeys", () => {
    it("returns false for null and undefined", () => {
        expect(hasKeys(null)).toBe(false);
        expect(hasKeys(undefined)).toBe(false);
    });

    it("returns false for non-object primitives", () => {
        expect(hasKeys(0)).toBe(false);
        expect(hasKeys("")).toBe(false);
        expect(hasKeys(true)).toBe(false);
        expect(hasKeys(Symbol("x"))).toBe(false);
    });

    it("returns false for arrays even when non-empty", () => {
        expect(hasKeys([])).toBe(false);
        expect(hasKeys([1, 2, 3])).toBe(false);
    });

    it("returns false for empty objects", () => {
        expect(hasKeys({})).toBe(false);
    });

    it("returns true for objects with at least one own enumerable key", () => {
        expect(hasKeys({ a: 1 })).toBe(true);
        expect(hasKeys({ a: undefined })).toBe(true);
    });

    it("returns true for objects with multiple keys", () => {
        expect(hasKeys({ a: 1, b: 2 })).toBe(true);
    });

    it("returns false for objects without own enumerable properties", () => {
        expect(hasKeys(Object.create(null))).toBe(false);
    });

    it("returns true for class instances with enumerable properties", () => {
        class Test {
            a = 1;
        }

        expect(hasKeys(new Test())).toBe(true);
    });

    it("returns false for Date objects", () => {
        expect(hasKeys(new Date())).toBe(false);
    });
});

describe("isValidData", () => {
    it("returns false for null and undefined", () => {
        expect(isValidData(null)).toBe(false);
        expect(isValidData(undefined)).toBe(false);
    });

    it("returns false for empty or whitespace-only strings", () => {
        expect(isValidData("")).toBe(false);
        expect(isValidData("   ")).toBe(false);
    });

    it("returns true for non-empty strings", () => {
        expect(isValidData("node01")).toBe(true);
    });

    it("returns false for NaN and non-finite numbers", () => {
        expect(isValidData(NaN)).toBe(false);
        expect(isValidData(Infinity)).toBe(false);
        expect(isValidData(-Infinity)).toBe(false);
    });

    it("returns true for finite numbers including zero", () => {
        expect(isValidData(0)).toBe(true);
        expect(isValidData(42)).toBe(true);
        expect(isValidData(-1)).toBe(true);
    });

    it("returns false for empty arrays", () => {
        expect(isValidData([])).toBe(false);
    });

    it("returns false for arrays with no valid elements", () => {
        expect(isValidData([null, undefined, {}, []])).toBe(false);
    });

    it("returns true for arrays containing at least one valid element", () => {
        expect(isValidData([null, { a: 1 }])).toBe(true);
        expect(isValidData(["", "ok"])).toBe(true);
    });

    it("returns false for empty objects", () => {
        expect(isValidData({})).toBe(false);
    });

    it("returns false for objects whose values are all invalid", () => {
        expect(isValidData({ a: null })).toBe(false);
        expect(isValidData({ a: {}, b: [] })).toBe(false);
    });

    it("returns true for objects with at least one valid value", () => {
        expect(isValidData({ a: 0 })).toBe(true);
        expect(isValidData({ a: { b: "data" } })).toBe(true);
    });

    it("recursively detects valid data deep in a tree", () => {
        const tree = {
            cluster: {
                nodes: [
                    {
                        status: {
                            cpu: 0.42,
                        },
                    },
                ],
            },
        };

        expect(isValidData(tree)).toBe(true);
    });

    it("returns false for deeply nested but entirely empty structures", () => {
        const tree = {
            cluster: {
                nodes: [
                    {
                        status: {},
                    },
                ],
            },
        };

        expect(isValidData(tree)).toBe(false);
    });
});
