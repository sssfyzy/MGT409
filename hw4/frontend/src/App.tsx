import { useEffect, useRef, useState, type FormEvent, type MouseEvent, type ReactNode } from 'react'
import AuthPage, { type AuthUser } from './AuthPage'

type Stock = { size: string; quantity: number }
type Product = {
  product_id: string; name: string; garment_type: string; description: string
  colors: string[]; search_tags: string[]; image_file_path: string
  image_url: string; price: number; inventory: Stock[]
}
type ChatProduct = {
  product_id: string; name: string; price: number; image_url: string
  description: string; product_url: string
}
type ChatMessage = { role: 'user' | 'assistant'; text: string; products: ChatProduct[] }

const money = (amount: number) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD',
}).format(amount)

function usePathname() {
  const [path, setPath] = useState(window.location.pathname)
  useEffect(() => {
    const update = () => setPath(window.location.pathname)
    window.addEventListener('popstate', update)
    return () => window.removeEventListener('popstate', update)
  }, [])
  return path
}

function navigate(href: string) {
  window.history.pushState({}, '', href)
  window.dispatchEvent(new PopStateEvent('popstate'))
  window.scrollTo(0, 0)
}

function Link({ href, children, className = '', onNavigate }: {
  href: string; children: ReactNode; className?: string; onNavigate?: () => void
}) {
  function click(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    navigate(href)
    onNavigate?.()
  }
  return <a href={href} className={className} onClick={click}>{children}</a>
}

function ProductCard({ product }: { product: Product }) {
  return <Link href={`/products/${encodeURIComponent(product.product_id)}`} className="product-card">
    <div className="product-card-image"><img src={product.image_url} alt={product.name} loading="lazy" /></div>
    <div className="product-card-body"><span className="eyebrow">{product.garment_type}</span>
      <div className="product-card-heading"><h3>{product.name}</h3><strong>{money(product.price)}</strong></div>
      <p>{product.description}</p><span className="text-link">View details ↗</span>
    </div>
  </Link>
}

function ChatWidget({ currentUser, path }: { currentUser: AuthUser | null; path: string }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sending, setSending] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [chatError, setChatError] = useState('')
  const [failedMessage, setFailedMessage] = useState<string | null>(null)
  const accountVersion = useRef(0)
  const messagesRef = useRef<HTMLDivElement>(null)
  const userId = currentUser?.id

  useEffect(() => {
    const version = ++accountVersion.current
    setMessages([])
    setSending(false)
    setHistoryError('')
    setChatError('')
    setFailedMessage(null)
    if (!userId) {
      setLoadingHistory(false)
      return
    }
    const controller = new AbortController()
    setLoadingHistory(true)
    fetch('/api/chat/history', { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error('Could not load your conversation.'); return response.json() })
      .then(data => { if (accountVersion.current === version) setMessages(data.messages as ChatMessage[]) })
      .catch(error => {
        if (error.name !== 'AbortError' && accountVersion.current === version) {
          setHistoryError('Your earlier messages could not be loaded. Please refresh and try again.')
        }
      })
      .finally(() => { if (accountVersion.current === version) setLoadingHistory(false) })
    return () => controller.abort()
  }, [userId])

  useEffect(() => {
    if (open && messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight
    }
  }, [open, messages, sending, chatError, loadingHistory])

  async function sendMessage(text: string, addUserMessage: boolean) {
    if (sending || loadingHistory) return
    const version = accountVersion.current
    if (addUserMessage) setMessages(current => [...current, { role: 'user', text, products: [] }])
    setChatError('')
    setFailedMessage(null)
    setSending(true)
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          page_path: path,
          product_id: path.startsWith('/products/') ? decodeURIComponent(path.slice('/products/'.length)) : null,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.detail || 'The chat is unavailable right now.')
      if (accountVersion.current === version) {
        setMessages(current => [...current, {
          role: 'assistant', text: data.message, products: data.products || [],
        }])
      }
    } catch (error) {
      if (accountVersion.current === version) {
        setChatError(error instanceof Error ? error.message : 'The chat is unavailable right now.')
        setFailedMessage(text)
      }
    } finally {
      if (accountVersion.current === version) setSending(false)
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = draft.trim()
    if (!text || failedMessage) return
    setDraft('')
    void sendMessage(text, true)
  }
  return <div className="chat-container">
    {open && <section className="chat-panel" aria-label="Shop chat">
      <header className="chat-header"><div><span className="chat-status" /><strong>Campus Customs chat</strong><small>Shopping help</small></div><button type="button" onClick={() => setOpen(false)} aria-label="Close chat">×</button></header>
      <div className="chat-messages" ref={messagesRef} aria-live="polite"><p className="chat-bubble assistant">Hi! What can I help you find?</p>
        {loadingHistory && <p className="chat-note">Loading your conversation…</p>}
        {historyError && <p className="chat-note error">{historyError}</p>}
        {messages.map((message, index) => message.role === 'user'
          ? <p className="chat-bubble user" key={index}>{message.text}</p>
          : <div className="chat-response" key={index}>
            <p className="chat-bubble assistant">{message.text}</p>
            {message.products.length > 0 && <div className="chat-products" aria-label="Recommended products">
              {message.products.map(product => <Link key={product.product_id} href={product.product_url} className="chat-product-card" onNavigate={() => setOpen(false)}>
                <img src={product.image_url} alt={product.name} loading="lazy" />
                <span className="chat-product-copy"><strong>{product.name}</strong><span>{money(product.price)}</span><small>{product.description}</small></span>
              </Link>)}
            </div>}
          </div>)}
        {sending && <p className="chat-bubble assistant">Thinking…</p>}
        {chatError && <div className="chat-retry" role="alert"><p>Message not delivered: {chatError}</p><div><button type="button" onClick={() => { if (failedMessage) void sendMessage(failedMessage, false) }} disabled={sending}>Retry</button><button type="button" onClick={() => { setChatError(''); setFailedMessage(null) }}>Dismiss</button></div></div>}
      </div>
      <form className="chat-form" onSubmit={submit}><label className="sr-only" htmlFor="chat-input">Message</label><input id="chat-input" value={draft} onChange={event => setDraft(event.target.value)} placeholder={failedMessage ? 'Retry or dismiss the failed message' : 'Ask about a product…'} disabled={sending || loadingHistory || !!failedMessage} /><button type="submit" aria-label="Send message" disabled={sending || loadingHistory || !!failedMessage || !draft.trim()}>↗</button></form>
    </section>}
    <button type="button" className="chat-launcher" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-label={open ? 'Close chat' : 'Open chat'}><span aria-hidden="true">{open ? '×' : '✦'}</span><span>{open ? 'Close' : 'Chat with us'}</span></button>
  </div>
}

function App() {
  const path = usePathname()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [garmentType, setGarmentType] = useState('')
  const [maxPrice, setMaxPrice] = useState('')

  useEffect(() => {
    fetch('/api/auth/me')
      .then(response => response.json())
      .then(data => setCurrentUser(data.user as AuthUser | null))
      .catch(() => setCurrentUser(null))
  }, [])

  const garmentTypes = Array.from(new Set(products.map(product => product.garment_type))).sort()
  const normalizedQuery = searchQuery.trim().toLowerCase().replace(/\bhoodies\b/g, 'hoodie')
  const priceLimit = maxPrice === '' ? null : Number(maxPrice)
  const filteredProducts = products.filter(product => {
    const matchesSearch = !normalizedQuery || [product.name, product.garment_type, product.description, ...product.search_tags, ...product.colors]
      .join(' ').toLowerCase().includes(normalizedQuery)
    return matchesSearch && (!garmentType || product.garment_type === garmentType)
      && (priceLimit === null || product.price <= priceLimit)
  })
  const hasFilters = !!(searchQuery || garmentType || maxPrice)
  const heroProduct = products.find(product => product.product_id === 'basic-hoodie-big-yale') ?? products[0]

  async function logout() {
    const response = await fetch('/api/auth/logout', { method: 'POST' })
    if (response.ok) {
      setCurrentUser(null)
      navigate('/')
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/products', { signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error('Product service is unavailable'); return response.json() })
      .then((data: Product[]) => { setProducts(data); setError('') })
      .catch(reason => { if (reason.name !== 'AbortError') setError('We could not load products. Please make sure the shop API is running, then refresh.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [])

  let page: ReactNode
  if (path === '/') {
    page = <main><section className="hero"><div className="hero-copy"><span className="eyebrow light">Campus Customs · Yale-inspired apparel</span><h1>Wear your campus story.</h1><p>From early mornings on the field to late nights with friends, find the layers that feel like your time at Yale.</p><Link href="/products" className="button button-light">Explore the collection ↗</Link><span className="hero-note">Your next favorite layer starts here.</span></div><div className="hero-art">{heroProduct ? <Link href={`/products/${encodeURIComponent(heroProduct.product_id)}`} className="hero-feature"><img src={heroProduct.image_url} alt={`Featured: ${heroProduct.name}`} /><span className="hero-feature-caption"><small>Featured from the collection</small><strong>{heroProduct.name}</strong><em>{money(heroProduct.price)} · View details ↗</em></span></Link> : <div className="hero-art-placeholder" aria-hidden="true">Y</div>}</div></section>
      <section className="section wrap"><div className="section-heading"><div><span className="eyebrow">Made for the moments between classes</span><h2>Campus favorites</h2></div><Link href="/products" className="text-link">Shop all products ↗</Link></div>{error && <p className="notice error">{error}</p>}{loading ? <p className="notice">Loading products…</p> : <div className="product-grid">{products.slice(0, 4).map(product => <ProductCard key={product.product_id} product={product} />)}</div>}</section>
      <section className="story-band"><div className="wrap story-content"><span className="eyebrow light">Campus Customs</span><h2>For the people who make a place their own.</h2><p>Find a piece for your college, your team, your family, or simply your favorite shade of blue.</p><Link href="/about" className="button button-outline">Our story ↗</Link></div></section></main>
  } else if (path === '/products') {
    page = <main className="wrap section"><div className="page-intro"><span className="eyebrow">The collection</span><h1>Products</h1><p>Browse campus layers, tees, and everyday pieces. Select a product to see its details and size stock.</p></div>{error && <p className="notice error">{error}</p>}{loading ? <p className="notice">Loading products…</p> : <><div className="product-filters" role="search" aria-label="Filter products"><label>Search products<input type="search" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="Name, color, or keyword" /></label><label>Product type<select value={garmentType} onChange={event => setGarmentType(event.target.value)}><option value="">All types</option>{garmentTypes.map(type => <option key={type} value={type}>{type}</option>)}</select></label><label>Maximum price ($)<input type="number" min="0" step="0.01" value={maxPrice} onChange={event => setMaxPrice(event.target.value)} placeholder="Any price" /></label>{hasFilters && <button type="button" onClick={() => { setSearchQuery(''); setGarmentType(''); setMaxPrice('') }}>Clear filters</button>}</div><p className="result-count" aria-live="polite">{filteredProducts.length} of {products.length} products</p>{filteredProducts.length ? <div className="product-grid">{filteredProducts.map(product => <ProductCard key={product.product_id} product={product} />)}</div> : <div className="empty-state filter-empty"><h2>No products match those filters.</h2><p>Try another keyword, product type, or price.</p><button type="button" className="button button-primary" onClick={() => { setSearchQuery(''); setGarmentType(''); setMaxPrice('') }}>Show all products</button></div>}</>}</main>
  } else if (path.startsWith('/products/')) {
    const id = decodeURIComponent(path.slice('/products/'.length))
    const product = products.find(item => item.product_id === id)
    page = <main className="wrap section detail-page"><Link href="/products" className="back-link">← All products</Link>{error && <p className="notice error">{error}</p>}{loading ? <p className="notice">Loading product…</p> : product ? <div className="detail-layout"><div className="detail-image"><img src={product.image_url} alt={product.name} /></div><div className="detail-copy"><span className="eyebrow">{product.garment_type}</span><h1>{product.name}</h1><p className="detail-price">{money(product.price)}</p><p className="detail-description">{product.description}</p><div className="detail-rule" /><h2>Size availability</h2><div className="size-list">{product.inventory.map(stock => <span key={stock.size} className={`size-pill ${stock.quantity === 0 ? 'sold-out' : ''}`}>{stock.size}<small>{stock.quantity === 0 ? 'Out of stock' : `${stock.quantity} in stock`}</small></span>)}</div><p className="stock-note">Stock is recorded by product and size. Listed colors do not confirm availability for a specific color and size together.</p><h2>Colors shown</h2><p className="color-list">{product.colors.join(' · ')}</p></div></div> : <div className="empty-state"><h1>Product not found</h1><p>That item is not in our current catalogue.</p><Link href="/products" className="button button-primary">Browse products</Link></div>}</main>
  } else if (path === '/about') {
    page = <main><section className="about-hero"><div className="wrap"><span className="eyebrow light">About Campus Customs</span><h1>Campus pride, worn your way.</h1><p>What you wear can carry a memory: a first game, a familiar courtyard, a team you always show up for.</p></div></section><section className="wrap section about-copy"><h2>More than a name on a sweatshirt</h2><p>Campus Customs brings together apparel inspired by Yale's colleges, teams, and everyday traditions. Our collection makes room for the details that matter to you, whether you're looking for a comfortable class-day layer or a gift for someone who still calls campus home.</p><p>Explore the catalogue, discover your next favorite piece, and check the available sizes on each product page.</p><Link href="/products" className="button button-primary">Find your piece ↗</Link></section></main>
  } else if (path === '/login' || path === '/create-account') {
    const creating = path === '/create-account'
    page = currentUser
      ? <main className="wrap section account-page"><div className="account-card"><span className="eyebrow">Your account</span><h1>Hi, {currentUser.first_name}.</h1><p>You are signed in as {currentUser.email}.</p><button type="button" className="button button-primary" onClick={logout}>Log out</button></div></main>
      : <AuthPage key={path} creating={creating} onSuccess={user => { setCurrentUser(user); navigate('/') }} />
  } else {
    page = <main className="wrap section empty-state"><h1>Page not found</h1><Link href="/" className="button button-primary">Back home</Link></main>
  }

  return <div className="site-shell"><div className="announcement">Campus Customs · Find your Yale-inspired favorite</div><header className="site-header"><div className="wrap nav-inner"><Link href="/" className="brand"><span className="brand-mark">Y</span><span>Campus <strong>Customs</strong><small>THE CAMPUS COLLECTION</small></span></Link><nav aria-label="Main navigation"><Link href="/" className={path === '/' ? 'active' : ''}>Home</Link><Link href="/products" className={path.startsWith('/products') ? 'active' : ''}>Products</Link><Link href="/about" className={path === '/about' ? 'active' : ''}>About Us</Link>{currentUser ? <><span className="signed-in-name">Hi, {currentUser.first_name}</span><button type="button" className="nav-logout" onClick={logout}>Log out</button></> : <><Link href="/login" className={path === '/login' ? 'active' : ''}>Log in</Link><Link href="/create-account" className={`nav-cta ${path === '/create-account' ? 'active' : ''}`}>Create account</Link></>}</nav></div></header>{page}<footer className="site-footer"><div className="wrap footer-inner"><div><strong>Campus Customs</strong><p>Everyday pieces for the campus stories you keep.</p></div><nav aria-label="Footer navigation"><Link href="/products">Products</Link><Link href="/about">About Us</Link><Link href="/login">Log in</Link></nav></div></footer><ChatWidget key={currentUser?.id ?? 'guest'} currentUser={currentUser} path={path} /></div>
}

export default App
