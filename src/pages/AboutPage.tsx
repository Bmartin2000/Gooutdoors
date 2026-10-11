const STACK = [
  { name: 'React', license: 'MIT', url: 'https://react.dev' },
  { name: 'React Router', license: 'MIT', url: 'https://reactrouter.com' },
  { name: 'three.js', license: 'MIT', url: 'https://threejs.org' },
  { name: 'React Three Fiber', license: 'MIT', url: 'https://r3f.docs.pmnd.rs' },
  { name: 'drei', license: 'MIT', url: 'https://github.com/pmndrs/drei' },
  { name: 'Vite', license: 'MIT', url: 'https://vite.dev' },
  { name: 'TypeScript', license: 'Apache-2.0', url: 'https://www.typescriptlang.org' },
  { name: 'Ollama', license: 'MIT', url: 'https://ollama.com' },
  { name: 'Qwen3.5 4B modell', license: 'Apache-2.0', url: 'https://ollama.com/library/qwen3.5' },
]

export default function AboutPage() {
  return (
    <section className="page">
      <h1>Nyílt forrás, ingyenesen</h1>
      <p>
        A Gooutdoors kizárólag nyílt forráskódú, ingyenes komponensekre épül. Az AI-modell helyben, az
        Ollamán keresztül fut: nincs API-kulcs, nincs felhőszolgáltatás, nincs követés.
      </p>
      <table className="licenses">
        <thead>
          <tr>
            <th>Komponens</th>
            <th>Licenc</th>
          </tr>
        </thead>
        <tbody>
          {STACK.map((s) => (
            <tr key={s.name}>
              <td>
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.name}
                </a>
              </td>
              <td>
                <code>{s.license}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted">A projekt forráskódja MIT licenc alatt érhető el – lásd a LICENSE fájlt.</p>
    </section>
  )
}
