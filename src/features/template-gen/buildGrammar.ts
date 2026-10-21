type Fragment = { text: string; syllables?: number; explicit?: boolean }; //the structure of the objects inside the pools in the theme JSON files
type ThemeFile = {
  theme: string;
  shapes: Record<string, string[]>;
  pools: Record<string, Fragment[]>;
}; //defines the structure of the theme JSON files

const modules = import.meta.glob<ThemeFile>("./themes/*.json", {
  eager: true,
  import: "default",
}); //retrieves the theme JSON files from the themes folder and imports them as modules

export function buildGrammar(allowExplicit = false) {
  const grammar: Record<string, string[]> = {
    themePick: []
  }; //only the themePick is initialized here, the rest of the grammar will be built dynamically based on the imported theme JSON files

  for (const t of Object.values(modules)) { //loop over the themes t is the current theme JSON file being processed
    const ns = (name: string) => `${t.theme}_${name}`; //helper function to namespace the grammar rules based on the theme name, to avoid naming collisions between different themes
    grammar.themePick!.push(t.theme);
    
    /*this loop extracts the texts from the pools, also checks if the explicit pools  
     * are allowed or not and adds them as another key value pair in the grammar object,  
     * the key is the name of the pool and the value is an array of strings
     * containing the texts from the pool 
    */

    for (const [name, frags] of Object.entries(t.pools)) { 
      grammar[ns(name)] = frags
        .filter(f => allowExplicit || !f.explicit)
        .map(f => f.text);
    }

    /**
     * This loop extracts the shapes from the theme JSON file and adds them as key-value pairs in the grammar object.
     * The key is the name of the shape and the value is an array of strings containing the templates for that shape.
     * The templates are processed to replace any references to other grammar rules with their namespaced versions.
     */
    const bars: string[] = [];
    for (const [shape, templates] of Object.entries(t.shapes)) {
      grammar[ns(shape)] = templates.map(tpl =>
        tpl.replace(/#(\w+)#/g, (_, n) => `#${ns(n)}#`)
      );
      bars.push(`#${ns(shape)}#`);
    }
    /**
     * Each theme will have its own set of bars, verses, and origins, 
     * which are added to the grammar object with namespaced keys.
     */
    grammar[`bar_${t.theme}`] = bars;
    grammar[`verse_${t.theme}`] = [Array(4).fill(`#bar_${t.theme}#`).join("\n")];
    grammar[`origin_${t.theme}`] = [`#verse_${t.theme}#`];
  }
  return grammar;
}