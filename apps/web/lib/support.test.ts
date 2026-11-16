import { describe, expect, it } from "vitest";
import { mentionsSelfHarm } from "./support";

describe("mentionsSelfHarm", () => {
  it("notices English, Roman Urdu and Urdu", () => {
    expect(mentionsSelfHarm("Honestly I just want to die after this semester")).toBe(true);
    expect(mentionsSelfHarm("I keep thinking about Suicide")).toBe(true);
    expect(mentionsSelfHarm("main marna  chahta hun")).toBe(true);
    expect(mentionsSelfHarm("khudkushi kar lun?")).toBe(true);
    expect(mentionsSelfHarm("میں خودکشی کے بارے میں سوچ رہا ہوں")).toBe(true);
  });

  it("leaves ordinary posts alone", () => {
    expect(mentionsSelfHarm("Anyone have DSA notes from Monday?")).toBe(false);
    expect(mentionsSelfHarm("This assignment is killing me lol")).toBe(false);
  });
});
