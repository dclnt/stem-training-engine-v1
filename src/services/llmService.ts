import Anthropic from '@anthropic-ai/sdk'
import type {
  SkillGraph,
  SkillNode,
  CAContent,
  DrillSet,
  DrillProblem,
  SessionResult,
  SourceInput,
  DepthLevel,
} from '../types'

// ─── Anthropic client (lazy — avoids SDK constructor throw on missing key) ──
// The Anthropic SDK throws synchronously when apiKey is empty, which would
// crash the entire React app at module-load time before any UI renders.
// Creating the client on first use means the error surfaces inside an async
// try/catch and the app falls back to mock data instead of going white.
const HAS_API_KEY = Boolean(import.meta.env.VITE_ANTHROPIC_API_KEY)
let _anthropicClient: Anthropic | null = null
function getClient(): Anthropic {
  if (!_anthropicClient) {
    if (!import.meta.env.VITE_ANTHROPIC_API_KEY) throw new Error('API_KEY_MISSING')
    _anthropicClient = new Anthropic({
      apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
      dangerouslyAllowBrowser: true,
    })
  }
  return _anthropicClient
}

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

// ─── MOCK DATA (fallback when no API key) ──────────────────────────────────

const TOPIC_GRAPHS: Record<string, Partial<SkillGraph>> = {
  fourier: {
    sourceTitle: 'Fourier Transforms',
    nodes: [
      { id: 'complex-arith', label: 'Complex number arithmetic', description: 'Add, subtract, multiply complex numbers', prerequisites: [], status: 'available', masteryData: null, estimatedSCT: 60, depth: 0 },
      { id: 'euler', label: "Euler's formula", description: 'e^(iθ) = cos θ + i sin θ and its applications', prerequisites: ['complex-arith'], status: 'locked', masteryData: null, estimatedSCT: 75, depth: 1 },
      { id: 'periodic-fn', label: 'Periodic function decomposition', description: 'Identify and decompose periodic signals', prerequisites: ['euler'], status: 'locked', masteryData: null, estimatedSCT: 90, depth: 2 },
      { id: 'integral-sin', label: 'Integral of sinusoids', description: 'Evaluate definite integrals of sin and cos', prerequisites: ['periodic-fn'], status: 'locked', masteryData: null, estimatedSCT: 80, depth: 3 },
      { id: 'dft-def', label: 'DFT definition', description: 'Compute the Discrete Fourier Transform by definition', prerequisites: ['integral-sin'], status: 'locked', masteryData: null, estimatedSCT: 120, depth: 4 },
      { id: 'fft-algo', label: 'FFT algorithm', description: 'Understand and apply the Fast Fourier Transform', prerequisites: ['dft-def'], status: 'locked', masteryData: null, estimatedSCT: 150, depth: 5 },
    ],
  },
  eigenvalues: {
    sourceTitle: 'Matrix Eigenvalues',
    nodes: [
      { id: 'matrix-sub', label: 'Matrix subtraction', description: 'Subtract two matrices element-wise', prerequisites: [], status: 'available', masteryData: null, estimatedSCT: 45, depth: 0 },
      { id: 'determinant', label: 'Determinant computation', description: 'Compute 2×2 and 3×3 determinants', prerequisites: ['matrix-sub'], status: 'locked', masteryData: null, estimatedSCT: 70, depth: 1 },
      { id: 'poly-factor', label: 'Polynomial factoring', description: 'Factor quadratic and cubic polynomials', prerequisites: ['determinant'], status: 'locked', masteryData: null, estimatedSCT: 65, depth: 2 },
      { id: 'char-poly', label: 'Characteristic polynomial', description: 'Form and expand det(A - λI)', prerequisites: ['poly-factor'], status: 'locked', masteryData: null, estimatedSCT: 90, depth: 3 },
      { id: 'eigenvalues', label: 'Finding eigenvalues', description: 'Solve the characteristic equation for λ', prerequisites: ['char-poly'], status: 'locked', masteryData: null, estimatedSCT: 100, depth: 4 },
      { id: 'eigenvectors', label: 'Computing eigenvectors', description: 'Find eigenvectors from eigenvalues via null space', prerequisites: ['eigenvalues'], status: 'locked', masteryData: null, estimatedSCT: 120, depth: 5 },
    ],
  },
  calculus: {
    sourceTitle: 'Differential Calculus',
    nodes: [
      { id: 'limits', label: 'Limits', description: 'Evaluate limits algebraically and graphically', prerequisites: [], status: 'available', masteryData: null, estimatedSCT: 60, depth: 0 },
      { id: 'deriv-def', label: 'Derivative definition', description: 'Apply the limit definition of the derivative', prerequisites: ['limits'], status: 'locked', masteryData: null, estimatedSCT: 75, depth: 1 },
      { id: 'power-rule', label: 'Power rule', description: 'Differentiate polynomial functions', prerequisites: ['deriv-def'], status: 'locked', masteryData: null, estimatedSCT: 50, depth: 2 },
      { id: 'chain-rule', label: 'Chain rule', description: 'Differentiate composite functions', prerequisites: ['power-rule'], status: 'locked', masteryData: null, estimatedSCT: 80, depth: 3 },
      { id: 'product-rule', label: 'Product & quotient rule', description: 'Differentiate products and quotients', prerequisites: ['chain-rule'], status: 'locked', masteryData: null, estimatedSCT: 85, depth: 4 },
      { id: 'optimization', label: 'Optimization', description: 'Find critical points and classify extrema', prerequisites: ['product-rule'], status: 'locked', masteryData: null, estimatedSCT: 120, depth: 5 },
    ],
  },
  python: {
    sourceTitle: 'Python Programming',
    nodes: [
      { id: 'py-variables', label: 'Variables & types', description: 'Assignment, primitive types, basic I/O', prerequisites: [], status: 'available', masteryData: null, estimatedSCT: 30, depth: 0 },
      { id: 'py-control', label: 'Control flow', description: 'if/elif/else, for and while loops, break/continue', prerequisites: ['py-variables'], status: 'locked', masteryData: null, estimatedSCT: 40, depth: 1 },
      { id: 'py-functions', label: 'Functions', description: 'def, parameters, return values, scope', prerequisites: ['py-control'], status: 'locked', masteryData: null, estimatedSCT: 50, depth: 2 },
      { id: 'py-lists', label: 'Lists & dicts', description: 'List/dict operations, comprehensions, iteration', prerequisites: ['py-functions'], status: 'locked', masteryData: null, estimatedSCT: 55, depth: 3 },
      { id: 'py-recursion', label: 'Recursion', description: 'Base case, recursive calls, call stack reasoning', prerequisites: ['py-functions'], status: 'locked', masteryData: null, estimatedSCT: 90, depth: 4 },
      { id: 'py-sorting', label: 'Sorting algorithms', description: 'Bubble sort, merge sort, Big-O complexity', prerequisites: ['py-recursion'], status: 'locked', masteryData: null, estimatedSCT: 120, depth: 5 },
    ],
  },
  statistics: {
    sourceTitle: 'Statistics & Probability',
    nodes: [
      { id: 'descriptive', label: 'Descriptive statistics', description: 'Mean, median, mode, variance, standard deviation', prerequisites: [], status: 'available', masteryData: null, estimatedSCT: 45, depth: 0 },
      { id: 'prob-basics', label: 'Probability basics', description: 'P(A), complement rule, addition rule, sample spaces', prerequisites: ['descriptive'], status: 'locked', masteryData: null, estimatedSCT: 55, depth: 1 },
      { id: 'cond-prob', label: 'Conditional probability', description: "P(A|B), Bayes' theorem, independence", prerequisites: ['prob-basics'], status: 'locked', masteryData: null, estimatedSCT: 70, depth: 2 },
      { id: 'distributions', label: 'Probability distributions', description: 'Normal, binomial, Poisson distributions', prerequisites: ['cond-prob'], status: 'locked', masteryData: null, estimatedSCT: 80, depth: 3 },
      { id: 'hypothesis', label: 'Hypothesis testing', description: 'Null hypothesis, p-value, t-test, significance', prerequisites: ['distributions'], status: 'locked', masteryData: null, estimatedSCT: 100, depth: 4 },
      { id: 'regression', label: 'Linear regression', description: 'Least squares, R², residuals, interpretation', prerequisites: ['hypothesis'], status: 'locked', masteryData: null, estimatedSCT: 90, depth: 5 },
    ],
  },
  physics: {
    sourceTitle: 'Mechanics & Physics',
    nodes: [
      { id: 'kinematics', label: 'Kinematics (1D)', description: 'Displacement, velocity, acceleration, SUVAT equations', prerequisites: [], status: 'available', masteryData: null, estimatedSCT: 50, depth: 0 },
      { id: 'vectors-2d', label: 'Vectors in 2D', description: 'Vector addition, components, magnitude, direction', prerequisites: ['kinematics'], status: 'locked', masteryData: null, estimatedSCT: 60, depth: 1 },
      { id: 'newtons-laws', label: "Newton's laws", description: 'F = ma, N1/N2/N3, free body diagrams', prerequisites: ['vectors-2d'], status: 'locked', masteryData: null, estimatedSCT: 70, depth: 2 },
      { id: 'work-energy', label: 'Work & energy', description: 'Work, KE, PE, conservation of energy', prerequisites: ['newtons-laws'], status: 'locked', masteryData: null, estimatedSCT: 75, depth: 3 },
      { id: 'momentum', label: 'Momentum & impulse', description: 'p = mv, impulse-momentum theorem, collisions', prerequisites: ['work-energy'], status: 'locked', masteryData: null, estimatedSCT: 80, depth: 4 },
      { id: 'circular', label: 'Circular motion', description: 'Centripetal force, angular velocity, period', prerequisites: ['momentum'], status: 'locked', masteryData: null, estimatedSCT: 90, depth: 5 },
    ],
  },
  linear_algebra: {
    sourceTitle: 'Linear Algebra',
    nodes: [
      { id: 'vector-ops', label: 'Vector operations', description: 'Addition, scalar multiplication, dot & cross product', prerequisites: [], status: 'available', masteryData: null, estimatedSCT: 45, depth: 0 },
      { id: 'matrix-mult', label: 'Matrix multiplication', description: 'Row-by-column product, identity, zero matrix', prerequisites: ['vector-ops'], status: 'locked', masteryData: null, estimatedSCT: 60, depth: 1 },
      { id: 'row-reduction', label: 'Row reduction', description: 'Gaussian elimination, reduced row echelon form', prerequisites: ['matrix-mult'], status: 'locked', masteryData: null, estimatedSCT: 80, depth: 2 },
      { id: 'null-space', label: 'Null space & rank', description: 'Solving Ax = 0, rank-nullity theorem', prerequisites: ['row-reduction'], status: 'locked', masteryData: null, estimatedSCT: 90, depth: 3 },
      { id: 'projections', label: 'Projections', description: 'Orthogonal projection, least squares', prerequisites: ['null-space'], status: 'locked', masteryData: null, estimatedSCT: 100, depth: 4 },
      { id: 'orthogonal', label: 'Orthogonalization', description: 'Gram–Schmidt process, orthonormal bases', prerequisites: ['projections'], status: 'locked', masteryData: null, estimatedSCT: 110, depth: 5 },
    ],
  },
  javascript: {
    sourceTitle: 'JavaScript Programming',
    nodes: [
      { id: 'js-vars', label: 'Variables & declarations', description: 'Declare variables with var, let, and const; understand scope and hoisting', prerequisites: [], status: 'available', masteryData: null, estimatedSCT: 30, depth: 0 },
      { id: 'js-destructure', label: 'Destructuring assignment', description: 'Extract values from objects and arrays using destructuring syntax', prerequisites: ['js-vars'], status: 'locked', masteryData: null, estimatedSCT: 45, depth: 1 },
      { id: 'js-arrow', label: 'Arrow functions', description: 'Write concise functions with arrow syntax and understand lexical this binding', prerequisites: ['js-vars'], status: 'locked', masteryData: null, estimatedSCT: 40, depth: 1 },
      { id: 'js-array-methods', label: 'Array methods', description: 'Use map, filter, reduce, find, and forEach on arrays', prerequisites: ['js-arrow'], status: 'locked', masteryData: null, estimatedSCT: 55, depth: 2 },
      { id: 'js-closures', label: 'Closures & scope', description: 'Understand how inner functions capture outer variables through closures', prerequisites: ['js-arrow'], status: 'locked', masteryData: null, estimatedSCT: 70, depth: 2 },
      { id: 'js-async', label: 'Async/Await & Promises', description: 'Write asynchronous code using Promise chains and async/await syntax', prerequisites: ['js-closures'], status: 'locked', masteryData: null, estimatedSCT: 90, depth: 3 },
    ],
  },
}

function detectTopic(source: SourceInput): string {
  const searchText = [source.fileContent, source.value, source.filename]
    .filter(Boolean).join(' ').toLowerCase()
  if (/fourier|dft|fft|frequency[\s-]domain|signal[\s-]process|spectral/.test(searchText)) return 'fourier'
  if (/eigen|characteristic[\s-]poly|matrix[\s-]decom/.test(searchText)) return 'eigenvalues'
  if (/linear[\s-]algebra|vector[\s-]space|null[\s-]space|row[\s-]reduc|dot[\s-]product|orthogonal|gram.schmidt/.test(searchText)) return 'linear_algebra'
  if (/statistic|probability|distribution|variance|std[\s-]dev|hypothesis|regression|p[\s-]value|bayes|normal[\s-]dist/.test(searchText)) return 'statistics'
  // JavaScript gets its own dedicated key — must come before the python check
  if (/\bjavascript\b|destructur|\.jsx?\b|es6|es2015|const\s+\w|let\s+\w|arrow\s+func|closure|async\s+func|await\s+|promise|prototype|node\.?js|\.tsx?\b/.test(searchText)) return 'javascript'
  if (/\bpython\b|typescript|\bdef\b|\bimport\b|algorithm|sorting|recursion|big.o|linked[\s-]list|binary[\s-]tree|hash[\s-]map|dynamic[\s-]program|data[\s-]struct/.test(searchText)) return 'python'
  if (/physics|newton|force|velocity|acceleration|momentum|kinematics|thermodynamics|electro|quantum|wave/.test(searchText)) return 'physics'
  if (/derivative|integral|limit|differentiat|chain[\s-]rule|taylor|calculus|antideriv/.test(searchText)) return 'calculus'
  if (/determinant|matrix/.test(searchText)) return 'eigenvalues'
  // Default to javascript rather than calculus — safer neutral fallback for unrecognised code/text content
  return 'javascript'
}

function mockBuildGraph(source: SourceInput): SkillGraph {
  const topicKey = detectTopic(source)
  const template = TOPIC_GRAPHS[topicKey] ?? TOPIC_GRAPHS['javascript']
  return {
    id: uid(),
    sourceTitle: template.sourceTitle!,
    sourceType: source.type,
    sourceSummary: `Skill graph generated from your ${source.type} source covering ${template.sourceTitle}.`,
    sourceContent: (source.fileContent ?? source.value ?? '').slice(0, 2000),
    nodes: (template.nodes as SkillNode[]).map(n => ({ ...n })),
    createdAt: Date.now(),
  }
}

function mockMakeCAContent(skill: SkillNode): CAContent {
  const prereqList = skill.prerequisites.length > 0
    ? skill.prerequisites.map(p => `- ${p}`).join('\n')
    : '- No prerequisites — this is a foundational skill.'
  return {
    overview: `**${skill.label}** is a key skill in this topic. Understanding it requires knowing where it fits in the bigger picture:\n\n- It builds on: ${skill.prerequisites.join(', ') || 'foundational concepts'}\n- It enables: more advanced skills that depend on this one\n- Core purpose: ${skill.description}`,
    workedExample: `**Worked Example — ${skill.label}**\n\nLet's walk through a concrete problem step by step:\n\n1. **Setup** — Read the problem carefully. Identify what you are given and what you need to find.\n2. **Strategy** — Choose your approach based on what ${skill.label} requires. Map out your solution path before executing.\n3. **Execution** — Apply ${skill.label} precisely. Work through each sub-step without skipping.\n4. **Verification** — Check your result by working backwards or using an alternative method.`,
    expertAnnotations: [
      `Experts pause at step 1 to fully understand the problem before touching ${skill.label} mechanics.`,
      'A deliberate false start at step 2 is normal — experts recover from wrong paths quickly because they verify early.',
      'Verification (step 4) is non-negotiable: it catches errors that careful execution misses.',
    ],
    coachingHints: [
      `Hint 1: What is the core operation in **${skill.label}**? Name it explicitly before doing anything else.`,
      `Hint 2: Review your prerequisite knowledge:\n${prereqList}\nCan you recall each one fluently?`,
      'Hint 3: If stuck, solve a simpler version of the same problem first, then scale up to the full version.',
    ],
    articulationPrompt: `Now apply **${skill.label}** to a new problem. After solving, write 2–3 sentences explaining:\n\n1. Why you chose your approach\n2. Where an alternative strategy was possible\n3. What would change if the inputs were different`,
    reflectionComparison: `Compare your approach to the expert walkthrough above:\n\n- Did you map out your solution path **before** executing, or jump straight in?\n- Did you verify your answer, or stop at execution?\n- **Expert flow:** global scan → strategy → execute → verify\n\nThe gap between your flow and the expert's is your growth edge.`,
    explorationSeed: `Ready to go deeper? Choose one challenge:\n\n- Apply **${skill.label}** to a problem one level of difficulty harder\n- Find a real-world context where this skill is the critical bottleneck\n- Ask yourself: what breaks in the system if you skip or misapply this skill?`,
  }
}

// ─── DRILL BANKS (mock fallback, with LaTeX notation) ─────────────────────

const DRILL_BANKS: Record<string, DrillProblem[]> = {
  'matrix-sub': [
    { id: uid(), skillId: 'matrix-sub', prompt: 'Compute $A - B$ where $A = \\begin{pmatrix}3&1\\\\2&5\\end{pmatrix}$ and $B = \\begin{pmatrix}1&4\\\\0&2\\end{pmatrix}$', answer: '$\\begin{pmatrix}2&-3\\\\2&3\\end{pmatrix}$', hint: 'Subtract element-wise.', variationType: 'standard', targetSeconds: 30 },
    { id: uid(), skillId: 'matrix-sub', prompt: 'Compute $A - B$ where $A = \\begin{pmatrix}7&0\\\\-1&4\\end{pmatrix}$ and $B = \\begin{pmatrix}3&2\\\\1&1\\end{pmatrix}$', answer: '$\\begin{pmatrix}4&-2\\\\-2&3\\end{pmatrix}$', hint: 'Watch the sign on row 2.', variationType: 'standard', targetSeconds: 30 },
    { id: uid(), skillId: 'matrix-sub', prompt: 'Find $M = P - Q$ where $P = \\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}$ and $Q = \\begin{pmatrix}e&f\\\\g&h\\end{pmatrix}$', answer: '$\\begin{pmatrix}a-e&b-f\\\\c-g&d-h\\end{pmatrix}$', hint: 'Work symbolically, entry by entry.', variationType: 'symbolic', targetSeconds: 25 },
    { id: uid(), skillId: 'matrix-sub', prompt: 'Compute $\\begin{pmatrix}5&3&1\\\\2&6&0\\end{pmatrix} - \\begin{pmatrix}2&1&4\\\\1&3&-1\\end{pmatrix}$', answer: '$\\begin{pmatrix}3&2&-3\\\\1&3&1\\end{pmatrix}$', hint: 'This is a 2×3 matrix — subtract each position.', variationType: 'numeric', targetSeconds: 40 },
    { id: uid(), skillId: 'matrix-sub', prompt: 'If $A - B = \\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}$ and $B = \\begin{pmatrix}0&1\\\\1&0\\end{pmatrix}$, find $A$.', answer: '$\\begin{pmatrix}1&3\\\\4&4\\end{pmatrix}$', hint: 'Add $B$ to both sides: $A = (A-B) + B$.', variationType: 'inverse', targetSeconds: 35 },
  ],
  'determinant': [
    { id: uid(), skillId: 'determinant', prompt: 'Compute $\\det\\begin{pmatrix}4&3\\\\2&1\\end{pmatrix}$', answer: '$-2$', hint: '$\\det = ad - bc$', variationType: 'standard', targetSeconds: 20 },
    { id: uid(), skillId: 'determinant', prompt: 'Compute $\\det\\begin{pmatrix}6&0\\\\5&3\\end{pmatrix}$', answer: '$18$', hint: 'Upper triangular: product of diagonal entries.', variationType: 'standard', targetSeconds: 20 },
    { id: uid(), skillId: 'determinant', prompt: 'Compute $\\det\\begin{pmatrix}1&2&3\\\\0&4&5\\\\1&0&6\\end{pmatrix}$', answer: '$22$', hint: 'Expand along the first row.', variationType: 'numeric', targetSeconds: 60 },
    { id: uid(), skillId: 'determinant', prompt: 'Compute $\\det\\begin{pmatrix}a&b\\\\c&d\\end{pmatrix}$', answer: '$ad - bc$', hint: 'Standard 2×2 determinant formula.', variationType: 'symbolic', targetSeconds: 15 },
    { id: uid(), skillId: 'determinant', prompt: 'If $\\det\\begin{pmatrix}x&2\\\\3&x\\end{pmatrix} = 10$, find $x$.', answer: '$x = 4$ or $x = -4$', hint: 'Set $x^2 - 6 = 10$, then solve the quadratic.', variationType: 'inverse', targetSeconds: 45 },
  ],
  'complex-arith': [
    { id: uid(), skillId: 'complex-arith', prompt: 'Compute $(3 + 2i) + (1 - 4i)$', answer: '$4 - 2i$', hint: 'Add real parts and imaginary parts separately.', variationType: 'standard', targetSeconds: 20 },
    { id: uid(), skillId: 'complex-arith', prompt: 'Compute $(2 + 3i)(1 - i)$', answer: '$5 + i$', hint: 'FOIL and remember $i^2 = -1$.', variationType: 'standard', targetSeconds: 30 },
    { id: uid(), skillId: 'complex-arith', prompt: 'Find the modulus $|3 + 4i|$', answer: '$5$', hint: '$|z| = \\sqrt{a^2 + b^2}$', variationType: 'numeric', targetSeconds: 25 },
    { id: uid(), skillId: 'complex-arith', prompt: 'Compute $(a + bi)(a - bi)$', answer: '$a^2 + b^2$', hint: 'This is a conjugate product — no imaginary part remains.', variationType: 'symbolic', targetSeconds: 20 },
    { id: uid(), skillId: 'complex-arith', prompt: 'If $z = 1 + i$, compute $z^3$', answer: '$-2 + 2i$', hint: 'Compute $z^2 = 2i$ first, then $z^3 = z^2 \\cdot z$.', variationType: 'applied', targetSeconds: 50 },
  ],
  'limits': [
    { id: uid(), skillId: 'limits', prompt: 'Evaluate $\\lim_{x \\to 2} \\dfrac{x^2 - 4}{x - 2}$', answer: '$4$', hint: 'Factor the numerator: $x^2 - 4 = (x+2)(x-2)$.', variationType: 'standard', targetSeconds: 35 },
    { id: uid(), skillId: 'limits', prompt: 'Evaluate $\\lim_{x \\to \\infty} \\dfrac{3x^2 + 1}{x^2 - 5}$', answer: '$3$', hint: 'Divide numerator and denominator by $x^2$.', variationType: 'standard', targetSeconds: 30 },
    { id: uid(), skillId: 'limits', prompt: 'Evaluate $\\lim_{x \\to 0} \\dfrac{\\sin x}{x}$', answer: '$1$', hint: 'This is the standard squeeze-theorem result — memorise it.', variationType: 'standard', targetSeconds: 20 },
    { id: uid(), skillId: 'limits', prompt: 'Evaluate $\\lim_{x \\to 3} \\dfrac{x^2 - 9}{x - 3}$', answer: '$6$', hint: 'Factor: $x^2 - 9 = (x+3)(x-3)$.', variationType: 'numeric', targetSeconds: 30 },
    { id: uid(), skillId: 'limits', prompt: 'What does $\\lim_{x \\to a} f(x) = L$ mean intuitively?', answer: '$f(x)$ approaches $L$ as $x$ gets arbitrarily close to $a$ (without necessarily equalling $a$)', hint: 'Think about closeness, not equality at the point.', variationType: 'applied', targetSeconds: 40 },
  ],
  // Python mock bank
  'py-variables': [
    { id: uid(), skillId: 'py-variables', prompt: 'What does the following output?\n```python\nx = 5\ny = x * 2 + 1\nprint(y)\n```', answer: '11', hint: 'Evaluate the expression: 5 × 2 + 1.', variationType: 'standard', targetSeconds: 20 },
    { id: uid(), skillId: 'py-variables', prompt: 'What is the type of `x` after `x = 3.14`?', answer: 'float', hint: 'Numbers with a decimal point are floats in Python.', variationType: 'standard', targetSeconds: 15 },
    { id: uid(), skillId: 'py-variables', prompt: 'What does this print?\n```python\nname = "Alice"\nprint(f"Hello, {name}!")\n```', answer: 'Hello, Alice!', hint: 'f-strings interpolate variables inside `{}`.', variationType: 'numeric', targetSeconds: 20 },
    { id: uid(), skillId: 'py-variables', prompt: 'What is the value of `z`?\n```python\nz = 10 // 3\n```', answer: '3', hint: '`//` is integer (floor) division.', variationType: 'symbolic', targetSeconds: 15 },
    { id: uid(), skillId: 'py-variables', prompt: 'Write one line that swaps `a` and `b` without a temp variable.', answer: 'a, b = b, a', hint: 'Python supports tuple unpacking assignment.', variationType: 'applied', targetSeconds: 30 },
  ],
  'py-control': [
    { id: uid(), skillId: 'py-control', prompt: 'What does this print?\n```python\nfor i in range(3):\n    print(i)\n```', answer: '0\n1\n2', hint: '`range(3)` produces 0, 1, 2.', variationType: 'standard', targetSeconds: 20 },
    { id: uid(), skillId: 'py-control', prompt: 'What is printed?\n```python\nx = 7\nif x > 10:\n    print("big")\nelif x > 5:\n    print("medium")\nelse:\n    print("small")\n```', answer: 'medium', hint: '7 > 5 is True, so the `elif` branch runs.', variationType: 'standard', targetSeconds: 25 },
    { id: uid(), skillId: 'py-control', prompt: 'How many times does this loop run?\n```python\ni = 0\nwhile i < 5:\n    i += 2\n```', answer: '3', hint: 'i takes values 0, 2, 4 before becoming 6 (≥ 5).', variationType: 'numeric', targetSeconds: 30 },
    { id: uid(), skillId: 'py-control', prompt: 'What is printed?\n```python\nfor n in [1, 2, 3, 4, 5]:\n    if n % 2 == 0:\n        continue\n    print(n)\n```', answer: '1\n3\n5', hint: '`continue` skips even numbers.', variationType: 'symbolic', targetSeconds: 25 },
    { id: uid(), skillId: 'py-control', prompt: 'Write a loop that prints all multiples of 3 from 3 to 30.', answer: 'for i in range(3, 31, 3): print(i)', hint: '`range(start, stop, step)` — set step = 3.', variationType: 'applied', targetSeconds: 40 },
  ],
  // Statistics mock bank
  'descriptive': [
    { id: uid(), skillId: 'descriptive', prompt: 'Find the mean of $\\{3, 7, 7, 2, 9, 4\\}$.', answer: '$\\bar{x} = \\frac{32}{6} \\approx 5.33$', hint: 'Sum all values and divide by the count.', variationType: 'standard', targetSeconds: 30 },
    { id: uid(), skillId: 'descriptive', prompt: 'Find the median of $\\{4, 1, 7, 3, 9\\}$.', answer: '$4$', hint: 'Sort first: $\\{1, 3, 4, 7, 9\\}$ — the middle value is 4.', variationType: 'standard', targetSeconds: 25 },
    { id: uid(), skillId: 'descriptive', prompt: 'Compute the variance of $\\{2, 4, 4, 4, 5, 5, 7, 9\\}$.', answer: '$\\sigma^2 = 4$', hint: '$\\sigma^2 = \\frac{1}{n}\\sum(x_i - \\bar{x})^2$; the mean is 5.', variationType: 'numeric', targetSeconds: 60 },
    { id: uid(), skillId: 'descriptive', prompt: 'What is the standard deviation if the variance is $\\sigma^2 = 9$?', answer: '$\\sigma = 3$', hint: '$\\sigma = \\sqrt{\\sigma^2}$', variationType: 'symbolic', targetSeconds: 15 },
    { id: uid(), skillId: 'descriptive', prompt: 'A dataset has mean $\\bar{x} = 50$ and $\\sigma = 10$. What percentage of data lies within one standard deviation under the normal curve?', answer: 'Approximately 68%', hint: 'This is the 68-95-99.7 (empirical) rule.', variationType: 'applied', targetSeconds: 20 },
  ],
  // JavaScript mock bank
  'js-vars': [
    { id: uid(), skillId: 'js-vars', prompt: 'What is the output of this code?\n```javascript\nvar x = 1;\nif (true) { var x = 2; }\nconsole.log(x);\n```', answer: '2', hint: '`var` is function-scoped, not block-scoped — the inner `var x` overwrites the outer one.', variationType: 'standard', targetSeconds: 25 },
    { id: uid(), skillId: 'js-vars', prompt: 'What is the output of this code?\n```javascript\nlet y = 1;\nif (true) { let y = 2; }\nconsole.log(y);\n```', answer: '1', hint: '`let` is block-scoped — the inner `y` is confined to the `if` block.', variationType: 'standard', targetSeconds: 25 },
    { id: uid(), skillId: 'js-vars', prompt: 'What happens when you run this?\n```javascript\nconsole.log(a);\nvar a = 5;\n```', answer: 'undefined (not a ReferenceError)', hint: '`var` declarations are hoisted to the top of their scope, but the assignment stays in place.', variationType: 'numeric', targetSeconds: 30 },
    { id: uid(), skillId: 'js-vars', prompt: 'Which keyword(s) prevent reassignment after initial assignment?', answer: 'const', hint: '`const` prevents reassignment but does NOT make objects immutable.', variationType: 'symbolic', targetSeconds: 20 },
    { id: uid(), skillId: 'js-vars', prompt: 'Fix this code so it does not throw:\n```javascript\nconst obj = { count: 0 };\nobj.count += 1;\n```', answer: 'No fix needed — modifying a property of a const object is allowed. Only reassigning the variable itself would throw.', hint: '`const` prevents rebinding the variable, not mutating the object it points to.', variationType: 'applied', targetSeconds: 35 },
  ],
  'js-destructure': [
    { id: uid(), skillId: 'js-destructure', prompt: 'What is the value of `name` after this line?\n```javascript\nconst { name } = { name: "Alice", age: 30 };\n```', answer: '"Alice"', hint: 'Object destructuring extracts the property whose key matches the variable name.', variationType: 'standard', targetSeconds: 20 },
    { id: uid(), skillId: 'js-destructure', prompt: 'What does `b` equal?\n```javascript\nconst [a, b] = [10, 20, 30];\n```', answer: '20', hint: 'Array destructuring assigns by position — `b` gets the second element.', variationType: 'standard', targetSeconds: 20 },
    { id: uid(), skillId: 'js-destructure', prompt: 'Write one line that extracts `x` and `y` from `const point = { x: 4, y: 7 }`.', answer: 'const { x, y } = point;', hint: 'Use curly braces on the left side to destructure an object.', variationType: 'symbolic', targetSeconds: 25 },
    { id: uid(), skillId: 'js-destructure', prompt: 'What is `city` after this?\n```javascript\nconst { address: { city } } = { address: { city: "Paris" } };\n```', answer: '"Paris"', hint: 'Nested destructuring follows the shape of the object — chain the `{}` to go deeper.', variationType: 'numeric', targetSeconds: 30 },
    { id: uid(), skillId: 'js-destructure', prompt: 'Use destructuring to swap `a` and `b` in one line, given `let a = 1, b = 2`.', answer: '[a, b] = [b, a];', hint: 'Array destructuring on the left side can swap variables without a temp variable.', variationType: 'applied', targetSeconds: 30 },
  ],
  'js-arrow': [
    { id: uid(), skillId: 'js-arrow', prompt: 'Rewrite this as an arrow function:\n```javascript\nfunction add(a, b) { return a + b; }\n```', answer: 'const add = (a, b) => a + b;', hint: 'Single-expression arrow functions have an implicit return — no `return` keyword needed.', variationType: 'standard', targetSeconds: 25 },
    { id: uid(), skillId: 'js-arrow', prompt: 'What does this log?\n```javascript\nconst greet = name => `Hello, ${name}!`;\nconsole.log(greet("Bob"));\n```', answer: '"Hello, Bob!"', hint: 'Template literals use backticks and `${expression}` for interpolation.', variationType: 'standard', targetSeconds: 20 },
    { id: uid(), skillId: 'js-arrow', prompt: 'An arrow function with no parameters needs what syntax for the parameter list?', answer: '() — empty parentheses are required', hint: 'You can omit parentheses only when there is exactly ONE parameter.', variationType: 'symbolic', targetSeconds: 20 },
    { id: uid(), skillId: 'js-arrow', prompt: 'What is the key difference between arrow functions and regular functions regarding `this`?', answer: 'Arrow functions do not have their own `this` — they inherit `this` from the enclosing lexical scope', hint: 'This is called lexical `this` binding.', variationType: 'numeric', targetSeconds: 35 },
    { id: uid(), skillId: 'js-arrow', prompt: 'Write an arrow function `double` that returns a number multiplied by 2, then use it to double 7.', answer: 'const double = n => n * 2; double(7); // 14', hint: 'Single-parameter arrow functions need no parentheses around the parameter.', variationType: 'applied', targetSeconds: 30 },
  ],
  'js-array-methods': [
    { id: uid(), skillId: 'js-array-methods', prompt: 'What does this return?\n```javascript\n[1, 2, 3].map(x => x * 2);\n```', answer: '[2, 4, 6]', hint: '`map` returns a NEW array — same length, each element transformed by the callback.', variationType: 'standard', targetSeconds: 20 },
    { id: uid(), skillId: 'js-array-methods', prompt: 'What does this return?\n```javascript\n[1, 2, 3, 4].filter(x => x % 2 === 0);\n```', answer: '[2, 4]', hint: '`filter` keeps elements where the callback returns true.', variationType: 'standard', targetSeconds: 20 },
    { id: uid(), skillId: 'js-array-methods', prompt: 'What is the result?\n```javascript\n[1, 2, 3, 4].reduce((acc, x) => acc + x, 0);\n```', answer: '10', hint: '`reduce` accumulates a single value — the second argument (0) is the initial accumulator.', variationType: 'numeric', targetSeconds: 30 },
    { id: uid(), skillId: 'js-array-methods', prompt: 'Write one line to get all even numbers from `const nums = [1,2,3,4,5,6]` using a single array method.', answer: 'const evens = nums.filter(n => n % 2 === 0);', hint: 'Use `filter` with a modulo check.', variationType: 'symbolic', targetSeconds: 25 },
    { id: uid(), skillId: 'js-array-methods', prompt: 'Use `map` and `filter` together to get the squares of all odd numbers in `[1,2,3,4,5]`.', answer: '[1,2,3,4,5].filter(n => n % 2 !== 0).map(n => n * n) // [1, 9, 25]', hint: 'Chain: filter first to get odds, then map to square each.', variationType: 'applied', targetSeconds: 40 },
  ],
  // Physics mock bank
  'kinematics': [
    { id: uid(), skillId: 'kinematics', prompt: 'A car starts from rest and accelerates at $a = 3\\,\\text{m/s}^2$. What is its velocity after $t = 4\\,\\text{s}$?', answer: '$v = at = 12\\,\\text{m/s}$', hint: 'Use $v = u + at$ with $u = 0$.', variationType: 'standard', targetSeconds: 25 },
    { id: uid(), skillId: 'kinematics', prompt: 'How far does an object travel if it moves at $v = 5\\,\\text{m/s}$ for $t = 8\\,\\text{s}$?', answer: '$s = 40\\,\\text{m}$', hint: '$s = vt$ for constant velocity.', variationType: 'standard', targetSeconds: 20 },
    { id: uid(), skillId: 'kinematics', prompt: 'A ball is dropped from rest. Using $g = 9.8\\,\\text{m/s}^2$, how far does it fall in $t = 3\\,\\text{s}$?', answer: '$s = \\frac{1}{2}gt^2 = 44.1\\,\\text{m}$', hint: '$s = ut + \\frac{1}{2}at^2$ with $u = 0$.', variationType: 'numeric', targetSeconds: 40 },
    { id: uid(), skillId: 'kinematics', prompt: 'Write the SUVAT equation that relates $v$, $u$, $a$, and $s$ without $t$.', answer: '$v^2 = u^2 + 2as$', hint: 'Eliminate $t$ between $v = u + at$ and $s = ut + \\frac{1}{2}at^2$.', variationType: 'symbolic', targetSeconds: 30 },
    { id: uid(), skillId: 'kinematics', prompt: 'A train decelerates from $30\\,\\text{m/s}$ to rest over $150\\,\\text{m}$. Find the deceleration.', answer: '$a = -3\\,\\text{m/s}^2$', hint: 'Use $v^2 = u^2 + 2as$ with $v = 0$.', variationType: 'applied', targetSeconds: 45 },
  ],
}

function getFallbackProblems(skillId: string, skill?: SkillNode): DrillProblem[] {
  const text = (skill ? `${skill.label} ${skill.description}` : '').toLowerCase()
  // JavaScript / web / general programming — checked first
  if (/javascript|destructur|\.jsx?|closure|async|await|promise|prototype|node\.?js|\.tsx?/.test(text)) {
    return (DRILL_BANKS['js-destructure'] ?? DRILL_BANKS['js-vars'] ?? []).map(p => ({ ...p, skillId, id: uid() }))
  }
  if (/python|typescript|java|html|css|function|class|variable|loop|array|object|algorithm|data.struct|recursion|sorting|programming|code|software|web|script|property|method|syntax|binary|hash|tree|stack|queue/.test(text)) {
    return (DRILL_BANKS['py-variables'] ?? []).map(p => ({ ...p, skillId, id: uid() }))
  }
  if (/statistic|probability|distribution|variance|regression|bayes|p.value|hypothesis/.test(text)) {
    return (DRILL_BANKS['descriptive'] ?? []).map(p => ({ ...p, skillId, id: uid() }))
  }
  if (/physics|force|velocity|acceleration|momentum|kinematics|energy|newton|wave|quantum|circuit/.test(text)) {
    return (DRILL_BANKS['kinematics'] ?? []).map(p => ({ ...p, skillId, id: uid() }))
  }
  if (/matrix|linear.algebra|vector|null.space|determinant|eigen/.test(text)) {
    return (DRILL_BANKS['matrix-sub'] ?? []).map(p => ({ ...p, skillId, id: uid() }))
  }
  if (/complex|fourier|signal|frequency/.test(text)) {
    return (DRILL_BANKS['complex-arith'] ?? []).map(p => ({ ...p, skillId, id: uid() }))
  }
  if (/derivative|integral|limit|differentiat|chain.rule|calculus/.test(text)) {
    return (DRILL_BANKS['limits'] ?? []).map(p => ({ ...p, skillId, id: uid() }))
  }
  // True last resort: generic JS variables — avoids serving calculus for unrelated content
  return (DRILL_BANKS['js-vars'] ?? []).map(p => ({ ...p, skillId, id: uid() }))
}

function mockGetDrillSet(skill: SkillNode, previousSkill: SkillNode | null): DrillSet {
  const raw = DRILL_BANKS[skill.id] ?? getFallbackProblems(skill.id, skill)
  const problems = raw.slice(0, 10)
  const chainingProblems: DrillProblem[] = previousSkill
    ? (DRILL_BANKS[previousSkill.id] ?? getFallbackProblems(previousSkill.id))
        .slice(0, 5).map(p => ({ ...p, id: uid() }))
    : []
  return {
    problems,
    chainingProblems,
    targetSCT: skill.estimatedSCT,
    tempoStages: [0, Math.round(skill.estimatedSCT * 1.5), skill.estimatedSCT, Math.round(skill.estimatedSCT * 0.8)],
  }
}

// ─── CLAUDE API HELPERS ────────────────────────────────────────────────────

const SKILL_GRAPH_SYSTEM = `You are a STEM curriculum designer. Given learning material, you produce a JSON SkillGraph.

The SkillGraph schema is:
{
  "id": "string (random 8-char alphanum)",
  "sourceTitle": "string (inferred topic title)",
  "sourceType": "file | text | youtube | url",
  "sourceSummary": "string (1-2 sentences describing what the source covers)",
  "nodes": [
    {
      "id": "string (short kebab-case identifier)",
      "label": "string (skill name, max 6 words)",
      "description": "string (1 sentence — what the learner will be able to do)",
      "prerequisites": ["array of id strings of prerequisite skills"],
      "status": "available (only the first node) | locked (all others)",
      "masteryData": null,
      "estimatedSCT": number (estimated seconds to complete one problem fluently),
      "depth": number (0 = entry, increments by 1 per prerequisite layer)
    }
  ],
  "createdAt": number (unix timestamp ms)
}

Rules:
- Return ONLY valid JSON. No markdown. No explanations.
- Generate 4–8 nodes ordered from foundational (depth 0) to advanced.
- Prerequisites must reference only ids that already appear earlier in the nodes array.
- estimatedSCT should reflect real cognitive load: 20–30s for recall, 60–120s for multi-step problems.
- Keep node ids short and unique (e.g. "deriv-def", "chain-rule", "py-functions").

DEPTH CALIBRATION — apply based on current depth level:
- beginner: 4 nodes max. estimatedSCT generous (multiply standard estimates by 2.0). Descriptions use plain language and concrete analogies. Avoid jargon in labels and descriptions.
- intermediate: 5–6 nodes. Standard SCT. Balanced language with some domain terminology.
- advanced: 7 nodes. estimatedSCT tight (multiply by 0.85). Technical terminology expected throughout. Tighter prerequisite chains.
- graduate: 8 nodes. estimatedSCT very tight (multiply by 0.7). Assume deep domain knowledge. Abstract, research-level framing in descriptions.`

const DRILL_SET_SYSTEM = `You are a drill problem designer for any academic or professional subject, following the Kumon + Hanon spaced-repetition method.

CRITICAL DOMAIN CONSTRAINT — READ FIRST:
The user message contains a "SOURCE DOMAIN LOCK" block with a SOURCE EXCERPT from the learner's actual material.
Your ENTIRE response must stay within that exact subject domain.
- If the source is about JavaScript → every problem uses JavaScript code.
- If the source is about Renaissance art → every problem is about Renaissance art.
- If the source is about contract law → every problem is about contract law.
NEVER substitute a different domain. A calculus formula inside a JavaScript drill = wrong. A history question inside a physics drill = wrong.
The SOURCE EXCERPT is the ground truth — treat it like a locked context window.

Given a skill and its subject context, generate a DrillSet as JSON.

DrillSet schema:
{
  "problems": [ ...array of 5 DrillProblem objects... ],
  "chainingProblems": [],
  "targetSCT": number (same as estimatedSCT for the skill),
  "tempoStages": [0, targetSCT*1.5, targetSCT, targetSCT*0.8]
}

DrillProblem schema:
{
  "id": "string (random 8-char alphanum)",
  "skillId": "string (the skill's id)",
  "prompt": "string (the problem statement)",
  "answer": "string (the correct answer)",
  "hint": "string (one concise hint)",
  "variationType": "standard | symbolic | numeric | inverse | applied",
  "targetSeconds": number
}

Formatting rules — choose the format that matches the SOURCE DOMAIN:
- Programming/CS source: use triple-backtick fences with the correct language tag (javascript, python, html, etc.)
  Example: "What does this output?\\n\`\`\`javascript\\nconst { a } = { a: 1 }; console.log(a);\\n\`\`\`"
- Math/Physics source: use LaTeX in $...$ for inline or $$...$$ for block.
- Humanities/Science/other: use plain English prose with domain-accurate terminology.
- Cover all 5 variationTypes across the 5 problems (one each): standard, symbolic, numeric, inverse, applied.
- Return ONLY valid JSON. No markdown wrapper. No explanations outside the JSON.

DEPTH CALIBRATION — adjust targetSCT and problem difficulty based on current depth:
- beginner: targetSCT = estimatedSCT × 1.8 (generous — build accuracy first). Simple problem wording, single-step solutions.
- intermediate: targetSCT = estimatedSCT × 1.2. Standard difficulty.
- advanced: targetSCT = estimatedSCT × 0.9. Higher cognitive demand problems; multi-step where appropriate.
- graduate: targetSCT = estimatedSCT × 0.7 (near-expert speed expected). Graduate-level problem framing; abstract or edge-case scenarios.`

const CA_CONTENT_SYSTEM = `You are an expert educator using the Cognitive Apprenticeship framework for any academic or professional subject.

CRITICAL DOMAIN CONSTRAINT — READ FIRST:
The user message contains a "SOURCE DOMAIN LOCK" block with a SOURCE EXCERPT from the learner's actual material.
Every word of your response must stay within that exact subject domain.
- If the source is about JavaScript → every example, every step, every hint is about JavaScript.
- If the source is about organic chemistry → every example is organic chemistry.
- If the source is about music theory → every example is music theory.
NEVER drift to a different domain. "Minimises arithmetic error" in a JavaScript lesson = wrong. Calculus symbols in a programming lesson = wrong.
The SOURCE EXCERPT is the ground truth for subject domain — treat it like a locked context window.

Generate a CAContent object as JSON.

CAContent schema:
{
  "overview": "string",
  "workedExample": "string",
  "expertAnnotations": ["string", "string", "string"],
  "coachingHints": ["string", "string", "string"],
  "articulationPrompt": "string",
  "reflectionComparison": "string",
  "explorationSeed": "string"
}

ADHD-OPTIMISED CONTENT RULES — apply to every field:
- No walls of text. Every sentence stands alone. Short is always better than long.
- Use **bold** for key terms and action verbs only — not decoration.
- For sequential steps use a numbered list on SEPARATE LINES: "1. Step one\\n2. Step two\\n3. Step three" — REQUIRED in workedExample.
- For non-sequential points use a bullet list on SEPARATE LINES: "- Point one\\n- Point two" — REQUIRED in expertAnnotations and explorationSeed.
- For programming sources: use triple-backtick fences with the correct language tag for any code.
- For math/physics sources: use $...$ for inline LaTeX, $$...$$ for block math.

Field-specific rules (strict):
- overview: Exactly 3 sentences maximum. First sentence = the single core idea, plain and direct. No compound sentences. No parenthetical asides.
- workedExample: Exactly 4 numbered steps on separate lines. Start each step with a bold action verb: **Identify:**, **Choose:**, **Apply:**, **Verify:**. Each step is max 2 sentences. Punchy. Scannable. Use actual syntax or concepts from the SOURCE EXCERPT.
- expertAnnotations: Each of the 3 annotations is ONE short sentence. No "and" clauses. No compound sentences. Direct observation only.
- coachingHints: Each of the 3 hints is ONE directive line. Tell the learner exactly what to do next. No explanatory padding.
- articulationPrompt: One clear question. Max 15 words.
- reflectionComparison: Max 3 sentences. Compare the learner's likely approach to the expert approach.
- explorationSeed: Exactly 3 bullet items (- challenge). Each challenge is ONE short line. No sub-bullets.
- Return ONLY valid JSON. No markdown wrapper. No explanations outside the JSON.

DEPTH CALIBRATION — adjust content complexity based on current depth:
- beginner: Use concrete, everyday analogies in overview. Fully scaffolded workedExample steps with no assumed vocabulary. coachingHints are gentle, step-by-step.
- intermediate: Balanced. Some domain terminology with brief inline clarification where needed.
- advanced: Technical vocabulary throughout overview and worked example. Skip fundamentals. Terse, expert-facing language.
- graduate: Assume full expert context. Research-level framing. No scaffolding language. Overview may reference advanced theoretical considerations.`

function extractJSON(text: string): string {
  // IMPORTANT: Try outermost {…} FIRST.
  // The regex approach (below) uses a non-greedy match that stops at the first ``` it sees,
  // which breaks when drill problem prompts contain inner ```javascript code fences inside
  // the JSON string values — returning truncated invalid JSON and causing a parse error.
  // Grabbing from the first { to the last } always captures the full object correctly.
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start !== -1 && end !== -1) return text.slice(start, end + 1)
  // Fallback: strip a markdown code-fence wrapper if no braces were found at all
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (match) return match[1].trim()
  return text.trim()
}

async function callClaude(system: string, user: string): Promise<string> {
  const msg = await getClient().messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 4096,
    system,
    messages: [{ role: 'user', content: user }],
  })
  const block = msg.content[0]
  if (block.type !== 'text') throw new Error('Unexpected response type from Claude')
  return block.text
}

// ─── ANSWER EVALUATION ─────────────────────────────────────────────────────

function evaluateAnswer(userAnswer: string, correctAnswer: string): boolean {
  const norm = (s: string) =>
    s.toLowerCase()
      .replace(/\s/g, '')
      .replace(/[×x]/g, '*')
      .replace(/\$|\\[a-z]+\{?/g, '')  // strip LaTeX commands
      .replace(/[{}]/g, '')
  return norm(userAnswer) === norm(correctAnswer)
}

// ─── PUBLIC SERVICE ─────────────────────────────────────────────────────────

export const llmService = {
  async generateSkillGraph(source: SourceInput, depthLevel: DepthLevel = 'intermediate'): Promise<SkillGraph> {
    // No API key → hard stop. We never generate a wrong-subject graph as fallback.
    if (!HAS_API_KEY) {
      throw new Error('API_KEY_MISSING')
    }
    // Preserve up to 2000 chars of the original material so downstream calls can anchor content
    const sourceContent = (source.fileContent ?? source.value ?? '').slice(0, 2000)
    try {
      const content = source.fileContent ?? source.value ?? ''
      const userPrompt = `CURRENT DEPTH LEVEL: ${depthLevel}\n\n` + (content.length > 8000
        ? content.slice(0, 8000) + '\n\n[Content truncated — generate graph from what you can see above]'
        : content || `Source: ${source.filename ?? source.value ?? 'unknown'}`)
      const raw = await callClaude(SKILL_GRAPH_SYSTEM, userPrompt)
      const parsed = JSON.parse(extractJSON(raw))
      return {
        id: uid(),
        sourceTitle: parsed.sourceTitle ?? 'Generated Skill Graph',
        sourceType: source.type,
        sourceSummary: parsed.sourceSummary ?? '',
        sourceContent,
        nodes: (parsed.nodes as SkillNode[]).map((n, i) => ({
          ...n,
          status: i === 0 ? 'available' : 'locked',
          masteryData: null,
        })),
        createdAt: Date.now(),
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate skill graph'
      throw new Error(msg)
    }
  },

  async generateCAContent(skill: SkillNode, sourceContext?: string, depthLevel: DepthLevel = 'intermediate'): Promise<CAContent> {
    // No API key → hard stop. We never serve a generic/wrong-subject lesson as fallback.
    if (!HAS_API_KEY) {
      throw new Error('API_KEY_MISSING')
    }
    try {
      const domainBlock = sourceContext
        ? `═══ SOURCE DOMAIN LOCK ═══\n${sourceContext}\n══════════════════════════\n\n`
        : ''
      const userPrompt = `CURRENT DEPTH LEVEL: ${depthLevel}\n\n${domainBlock}Skill: "${skill.label}"\nDescription: ${skill.description}\nPrerequisites: ${skill.prerequisites.join(', ') || 'none'}\n\nGenerate Cognitive Apprenticeship content EXCLUSIVELY about "${skill.label}" within the subject domain described in the SOURCE DOMAIN LOCK above. Every example, every worked step, every hint MUST come from that domain. Do NOT introduce concepts, symbols, or examples from any other domain.`
      const raw = await callClaude(CA_CONTENT_SYSTEM, userPrompt)
      const parsed = JSON.parse(extractJSON(raw))
      return parsed as CAContent
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate lesson content'
      throw new Error(msg)
    }
  },

  async generateDrillSet(skill: SkillNode, previousSkill: SkillNode | null, sourceContext?: string, depthLevel: DepthLevel = 'intermediate'): Promise<DrillSet> {
    // No API key → hard stop. We never serve wrong-subject drill problems as fallback.
    if (!HAS_API_KEY) {
      throw new Error('API_KEY_MISSING')
    }
    try {
      const domainBlock = sourceContext
        ? `═══ SOURCE DOMAIN LOCK ═══\n${sourceContext}\n══════════════════════════\n\n`
        : ''
      const userPrompt = `CURRENT DEPTH LEVEL: ${depthLevel}\n\n${domainBlock}Skill id: "${skill.id}"\nSkill label: "${skill.label}"\nDescription: ${skill.description}\nestimatedSCT: ${skill.estimatedSCT} seconds\n\nAll 5 drill problems MUST test "${skill.label}" EXCLUSIVELY within the subject domain in the SOURCE DOMAIN LOCK above. Use the domain's native format (code blocks for programming, LaTeX for math, prose for humanities/science). Do NOT generate problems from any other domain — a calculus problem in a JavaScript skill = wrong, a physics problem in a history skill = wrong.`
      const raw = await callClaude(DRILL_SET_SYSTEM, userPrompt)
      const parsed = JSON.parse(extractJSON(raw))
      const problems: DrillProblem[] = (parsed.problems ?? []).map((p: DrillProblem) => ({
        ...p,
        id: uid(),
        skillId: skill.id,
      }))
      const chainingProblems: DrillProblem[] = previousSkill
        ? problems.slice(0, 2).map(p => ({ ...p, id: uid(), skillId: previousSkill.id }))
        : []
      return {
        problems,
        chainingProblems,
        targetSCT: skill.estimatedSCT,
        tempoStages: [0, Math.round(skill.estimatedSCT * 1.5), skill.estimatedSCT, Math.round(skill.estimatedSCT * 0.8)],
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate drill problems'
      throw new Error(msg)
    }
  },

  evaluateAnswer,

  async evaluateSession(
    skillId: string,
    answers: { problem: DrillProblem; userAnswer: string; timeMs: number }[]
  ): Promise<SessionResult> {
    await new Promise(r => setTimeout(r, 400))
    const correct = answers.filter(a => evaluateAnswer(a.userAnswer, a.problem.answer)).length
    const accuracy = answers.length > 0 ? correct / answers.length : 0
    const avgTime = answers.length > 0
      ? answers.reduce((s, a) => s + a.timeMs, 0) / answers.length / 1000
      : 999
    const targetSCT = answers[0]?.problem.targetSeconds ?? 60
    return {
      skillId,
      mode: 'drill',
      accuracy,
      avgSolveTime: avgTime,
      gatesPassed: accuracy >= 0.9 && avgTime <= targetSCT,
      completedAt: Date.now(),
    }
  },
}
