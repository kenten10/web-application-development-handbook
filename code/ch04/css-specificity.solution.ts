import { pathToFileURL } from 'node:url';

export interface Specificity { inline: number; id: number; class: number; type: number; important: boolean; }

function add(a: Specificity, b: Specificity): Specificity {
  return { inline: a.inline + b.inline, id: a.id + b.id, class: a.class + b.class, type: a.type + b.type, important: a.important || b.important };
}
function maxSpecificity(values: Specificity[]): Specificity {
  return values.reduce((best, value) => compareSpecificity(value, best) > 0 ? value : best, zero());
}
function zero(): Specificity { return { inline: 0, id: 0, class: 0, type: 0, important: false }; }

export function calculateSpecificity(selectorInput: string, inline = false): Specificity {
  let selector = selectorInput.trim();
  const important = /!important\s*$/.test(selector);
  selector = selector.replace(/!important\s*$/, '');
  let result: Specificity = { ...zero(), inline: inline ? 1 : 0, important };

  selector = selector.replace(/:(is|not|has)\(([^()]*)\)/g, (_match, _name: string, content: string) => {
    const alternatives = content.split(',').map((part) => calculateSpecificity(part.trim()));
    result = add(result, maxSpecificity(alternatives));
    return '';
  });
  selector = selector.replace(/:where\(([^()]*)\)/g, '');
  const ids = selector.match(/#[A-Za-z_][\w-]*/g) ?? [];
  result.id += ids.length;
  selector = selector.replace(/#[A-Za-z_][\w-]*/g, '');

  const classes = selector.match(/\.[A-Za-z_][\w-]*/g) ?? [];
  const attributes = selector.match(/\[[^\]]+\]/g) ?? [];
  const pseudoElements = selector.match(/::[A-Za-z-]+/g) ?? [];
  selector = selector.replace(/::[A-Za-z-]+/g, '');
  const pseudoClasses = selector.match(/:(?!:)[A-Za-z-]+(?:\([^)]*\))?/g) ?? [];
  result.class += classes.length + attributes.length + pseudoClasses.length;
  result.type += pseudoElements.length;
  selector = selector.replace(/\.[A-Za-z_][\w-]*|\[[^\]]+\]|:(?!:)[A-Za-z-]+(?:\([^)]*\))?/g, '');

  const typeTokens = selector.split(/[\s>+~,*]+/).map((token) => token.trim()).filter(Boolean);
  result.type += typeTokens.filter((token) => token !== '*' && /^[A-Za-z][\w-]*$/.test(token)).length;
  return result;
}

export function compareSpecificity(a: Specificity, b: Specificity): number {
  const av = [Number(a.important), a.inline, a.id, a.class, a.type];
  const bv = [Number(b.important), b.inline, b.id, b.class, b.type];
  for (let index = 0; index < av.length; index++) {
    const difference = av[index]! - bv[index]!;
    if (difference) return Math.sign(difference);
  }
  return 0;
}

export function sortSelectors(selectors: string[]): string[] {
  return [...selectors].sort((left, right) => compareSpecificity(calculateSpecificity(right), calculateSpecificity(left)));
}

const entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === entry) {
  const selector = process.argv.slice(2).join(' ') || '#header .nav li:hover a';
  console.log(selector, calculateSpecificity(selector));
}
