import React, { useState, useEffect } from 'react';

const WikipediaHegemonicRadar = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [articleData, setArticleData] = useState(null);
  const [recentChanges, setRecentChanges] = useState([]);
  const [pageViews, setPageViews] = useState(null);
  const [editHistory, setEditHistory] = useState([]);
  const [talkPage, setTalkPage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [comparisonMode, setComparisonMode] = useState(false);
  const [comparisonData, setComparisonData] = useState(null);
  const [trendingTopics, setTrendingTopics] = useState([]);

  // Fetch trending/most edited pages
  useEffect(() => {
    fetchTrendingTopics();
  }, []);

  const fetchTrendingTopics = async () => {
    try {
      const response = await fetch(
        'https://en.wikipedia.org/w/api.php?action=query&list=recentchanges&rcnamespace=0&rclimit=50&rctype=edit&rcprop=title|timestamp|user|comment&format=json&origin=*'
      );
      const data = await response.json();
      
      // Count edits per article
      const editCounts = {};
      data.query.recentchanges.forEach(change => {
        editCounts[change.title] = (editCounts[change.title] || 0) + 1;
      });
      
      // Sort by edit frequency
      const trending = Object.entries(editCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([title, count]) => ({ title, editCount: count }));
      
      setTrendingTopics(trending);
    } catch (error) {
      console.error('Error fetching trending:', error);
    }
  };

  const analyzeArticle = async (term) => {
    if (!term.trim()) return;
    setLoading(true);
    
    try {
      // Fetch article info
      const articleRes = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(term)}&prop=info|revisions|categories|links|langlinks&rvprop=size|timestamp|user|comment&rvlimit=50&lllimit=50&cllimit=50&format=json&origin=*`
      );
      const articleJson = await articleRes.json();
      const pages = articleJson.query.pages;
      const pageId = Object.keys(pages)[0];
      
      if (pageId === '-1') {
        setArticleData({ error: 'Article not found' });
        setLoading(false);
        return;
      }
      
      const page = pages[pageId];
      setArticleData(page);
      setEditHistory(page.revisions || []);

      // Fetch page views (last 60 days)
      const today = new Date();
      const sixtyDaysAgo = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000);
      const formatDate = (d) => d.toISOString().split('T')[0].replace(/-/g, '');
      
      try {
        const viewsRes = await fetch(
          `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/all-agents/${encodeURIComponent(term.replace(/ /g, '_'))}/daily/${formatDate(sixtyDaysAgo)}/${formatDate(today)}`
        );
        const viewsJson = await viewsRes.json();
        setPageViews(viewsJson.items || []);
      } catch (e) {
        setPageViews([]);
      }

      // Fetch talk page
      const talkRes = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&titles=Talk:${encodeURIComponent(term)}&prop=revisions&rvprop=size|timestamp|user|comment&rvlimit=30&format=json&origin=*`
      );
      const talkJson = await talkRes.json();
      const talkPages = talkJson.query.pages;
      const talkPageId = Object.keys(talkPages)[0];
      setTalkPage(talkPageId !== '-1' ? talkPages[talkPageId] : null);

    } catch (error) {
      console.error('Error analyzing article:', error);
      setArticleData({ error: 'Failed to fetch data' });
    }
    
    setLoading(false);
  };

  // Calculate hegemonic indicators
  const calculateIndicators = () => {
    if (!articleData || articleData.error) return null;

    const revisions = editHistory || [];
    const uniqueEditors = new Set(revisions.map(r => r.user)).size;
    const avgEditSize = revisions.length > 0 
      ? Math.abs(revisions.reduce((acc, r, i, arr) => {
          if (i === 0) return 0;
          return acc + Math.abs((arr[i-1].size || 0) - (r.size || 0));
        }, 0) / revisions.length)
      : 0;
    
    const totalViews = pageViews?.reduce((acc, p) => acc + p.views, 0) || 0;
    const langCount = articleData.langlinks?.length || 0;
    const categoryCount = articleData.categories?.length || 0;
    
    // Edit war detection (frequent reverts)
    const revertCount = revisions.filter(r => 
      r.comment?.toLowerCase().includes('revert') || 
      r.comment?.toLowerCase().includes('undid') ||
      r.comment?.toLowerCase().includes('rv ')
    ).length;

    // Calculate "canonization score" - how established is this knowledge
    const canonizationScore = Math.min(100, 
      (langCount * 2) + 
      (categoryCount * 3) + 
      (uniqueEditors > 10 ? 20 : uniqueEditors * 2) +
      (totalViews > 100000 ? 30 : totalViews / 3333)
    );

    // Calculate "contestation score" - how disputed is this knowledge
    const contestationScore = Math.min(100,
      (revertCount * 15) +
      (talkPage?.revisions?.length || 0) * 2 +
      (avgEditSize > 1000 ? 20 : avgEditSize / 50)
    );

    // Status indicator
    const statusScore = Math.min(100,
      (totalViews / 5000) +
      (langCount * 1.5) +
      (articleData.length > 50000 ? 30 : articleData.length / 1666)
    );

    return {
      uniqueEditors,
      avgEditSize: Math.round(avgEditSize),
      totalViews,
      langCount,
      categoryCount,
      revertCount,
      canonizationScore: Math.round(canonizationScore),
      contestationScore: Math.round(contestationScore),
      statusScore: Math.round(statusScore),
      talkPageActivity: talkPage?.revisions?.length || 0
    };
  };

  const indicators = calculateIndicators();

  const RadarChart = ({ data }) => {
    if (!data) return null;
    
    const metrics = [
      { label: 'Canonization', value: data.canonizationScore, color: '#00ff88' },
      { label: 'Contestation', value: data.contestationScore, color: '#ff4444' },
      { label: 'Status', value: data.statusScore, color: '#4488ff' },
      { label: 'Global Reach', value: Math.min(100, data.langCount * 2), color: '#ffaa00' },
      { label: 'Editor Diversity', value: Math.min(100, data.uniqueEditors * 5), color: '#aa44ff' }
    ];

    const centerX = 150;
    const centerY = 150;
    const maxRadius = 120;
    const angleStep = (2 * Math.PI) / metrics.length;

    const points = metrics.map((m, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const radius = (m.value / 100) * maxRadius;
      return {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        labelX: centerX + (maxRadius + 30) * Math.cos(angle),
        labelY: centerY + (maxRadius + 30) * Math.sin(angle),
        ...m
      };
    });

    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';

    return (
      <svg viewBox="0 0 300 300" style={{ width: '100%', maxWidth: '400px' }}>
        {/* Grid circles */}
        {[20, 40, 60, 80, 100].map(pct => (
          <circle
            key={pct}
            cx={centerX}
            cy={centerY}
            r={(pct / 100) * maxRadius}
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="1"
          />
        ))}
        
        {/* Axis lines */}
        {points.map((p, i) => (
          <line
            key={i}
            x1={centerX}
            y1={centerY}
            x2={centerX + maxRadius * Math.cos(i * angleStep - Math.PI / 2)}
            y2={centerY + maxRadius * Math.sin(i * angleStep - Math.PI / 2)}
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="1"
          />
        ))}
        
        {/* Data polygon */}
        <path
          d={pathD}
          fill="rgba(0, 255, 136, 0.2)"
          stroke="#00ff88"
          strokeWidth="2"
        />
        
        {/* Data points */}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="6" fill={p.color} />
            <text
              x={p.labelX}
              y={p.labelY}
              fill="#ccc"
              fontSize="10"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {p.label}
            </text>
          </g>
        ))}
      </svg>
    );
  };

  const ViewsChart = ({ data }) => {
    if (!data || data.length === 0) return <p style={{ color: '#666' }}>No view data available</p>;
    
    const maxViews = Math.max(...data.map(d => d.views));
    const chartHeight = 150;
    const chartWidth = 600;
    const barWidth = chartWidth / data.length;

    return (
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight + 40}`} style={{ width: '100%' }}>
        {data.map((d, i) => {
          const height = (d.views / maxViews) * chartHeight;
          return (
            <g key={i}>
              <rect
                x={i * barWidth}
                y={chartHeight - height}
                width={barWidth - 1}
                height={height}
                fill="rgba(0, 255, 136, 0.6)"
              />
              {i % 10 === 0 && (
                <text
                  x={i * barWidth + barWidth / 2}
                  y={chartHeight + 15}
                  fill="#666"
                  fontSize="8"
                  textAnchor="middle"
                >
                  {d.timestamp.slice(4, 6)}/{d.timestamp.slice(6, 8)}
                </text>
              )}
            </g>
          );
        })}
        <text x="0" y="12" fill="#888" fontSize="10">
          Peak: {maxViews.toLocaleString()} views
        </text>
      </svg>
    );
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #0f0f1a 100%)',
      color: '#e0e0e0',
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      padding: '0'
    }}>
      {/* Header */}
      <header style={{
        background: 'rgba(0,0,0,0.4)',
        borderBottom: '1px solid rgba(0, 255, 136, 0.2)',
        padding: '20px 40px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backdropFilter: 'blur(10px)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: '28px',
              fontWeight: 300,
              letterSpacing: '4px',
              color: '#00ff88',
              textTransform: 'uppercase'
            }}>
              HEGEMONIC RADAR
            </h1>
            <p style={{ margin: '5px 0 0', fontSize: '12px', color: '#666', letterSpacing: '2px' }}>
              WIKIPEDIA CULTURAL POWER ANALYSIS
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && analyzeArticle(searchTerm)}
              placeholder="Enter Wikipedia article title..."
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(0, 255, 136, 0.3)',
                padding: '12px 20px',
                borderRadius: '4px',
                color: '#fff',
                fontSize: '14px',
                width: '300px',
                outline: 'none'
              }}
            />
            <button
              onClick={() => analyzeArticle(searchTerm)}
              disabled={loading}
              style={{
                background: loading ? '#333' : 'linear-gradient(135deg, #00ff88, #00cc6a)',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '4px',
                color: '#000',
                fontSize: '14px',
                fontWeight: 600,
                cursor: loading ? 'wait' : 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '1px'
              }}
            >
              {loading ? 'Scanning...' : 'Analyze'}
            </button>
          </div>
        </div>
      </header>

      <main style={{ padding: '40px', maxWidth: '1600px', margin: '0 auto' }}>
        {/* Trending Topics Sidebar */}
        <div style={{ display: 'grid', gridTemplateColumns: articleData ? '1fr 300px' : '1fr', gap: '40px' }}>
          <div>
            {/* Navigation Tabs */}
            {articleData && !articleData.error && (
              <nav style={{ marginBottom: '30px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px' }}>
                {['overview', 'edits', 'views', 'talk', 'signals'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      background: activeTab === tab ? 'rgba(0, 255, 136, 0.2)' : 'transparent',
                      border: 'none',
                      padding: '10px 20px',
                      color: activeTab === tab ? '#00ff88' : '#888',
                      fontSize: '12px',
                      textTransform: 'uppercase',
                      letterSpacing: '2px',
                      cursor: 'pointer',
                      borderBottom: activeTab === tab ? '2px solid #00ff88' : '2px solid transparent',
                      marginBottom: '-11px'
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </nav>
            )}

            {/* Welcome State */}
            {!articleData && !loading && (
              <div style={{ textAlign: 'center', padding: '80px 20px' }}>
                <div style={{
                  fontSize: '80px',
                  marginBottom: '20px',
                  opacity: 0.3
                }}>📡</div>
                <h2 style={{ color: '#00ff88', fontWeight: 300, letterSpacing: '3px', marginBottom: '20px' }}>
                  CULTURAL SURVEILLANCE SYSTEM
                </h2>
                <p style={{ color: '#666', maxWidth: '600px', margin: '0 auto', lineHeight: 1.8 }}>
                  Enter a Wikipedia article to analyze hegemonic signals: whose knowledge is canonized, 
                  what narratives win edit wars, and how cultural power flows through collaborative knowledge production.
                </p>
                
                <div style={{ marginTop: '40px' }}>
                  <p style={{ color: '#444', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '15px' }}>
                    Quick Analysis Examples
                  </p>
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    {['Climate change', 'Feminism', 'Capitalism', 'China', 'Artificial intelligence'].map(topic => (
                      <button
                        key={topic}
                        onClick={() => { setSearchTerm(topic); analyzeArticle(topic); }}
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          padding: '8px 16px',
                          borderRadius: '20px',
                          color: '#888',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        {topic}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Loading State */}
            {loading && (
              <div style={{ textAlign: 'center', padding: '80px' }}>
                <div style={{
                  width: '60px',
                  height: '60px',
                  border: '3px solid rgba(0, 255, 136, 0.2)',
                  borderTop: '3px solid #00ff88',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 20px'
                }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                <p style={{ color: '#00ff88', letterSpacing: '2px' }}>SCANNING HEGEMONIC PATTERNS...</p>
              </div>
            )}

            {/* Error State */}
            {articleData?.error && (
              <div style={{
                background: 'rgba(255, 68, 68, 0.1)',
                border: '1px solid rgba(255, 68, 68, 0.3)',
                borderRadius: '8px',
                padding: '40px',
                textAlign: 'center'
              }}>
                <p style={{ color: '#ff4444', fontSize: '18px' }}>{articleData.error}</p>
                <p style={{ color: '#666', marginTop: '10px' }}>Try a different search term or check the spelling.</p>
              </div>
            )}

            {/* Main Content */}
            {articleData && !articleData.error && indicators && (
              <>
                {/* Overview Tab */}
                {activeTab === 'overview' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                    {/* Article Info Card */}
                    <div style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                      padding: '30px'
                    }}>
                      <h2 style={{ 
                        color: '#fff', 
                        fontWeight: 400, 
                        fontSize: '24px',
                        marginBottom: '20px',
                        borderBottom: '1px solid rgba(255,255,255,0.1)',
                        paddingBottom: '15px'
                      }}>
                        {articleData.title}
                      </h2>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div>
                          <p style={{ color: '#666', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>Article Size</p>
                          <p style={{ color: '#00ff88', fontSize: '24px', margin: '5px 0' }}>
                            {(articleData.length / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        <div>
                          <p style={{ color: '#666', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>Languages</p>
                          <p style={{ color: '#ffaa00', fontSize: '24px', margin: '5px 0' }}>
                            {indicators.langCount}
                          </p>
                        </div>
                        <div>
                          <p style={{ color: '#666', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>Categories</p>
                          <p style={{ color: '#4488ff', fontSize: '24px', margin: '5px 0' }}>
                            {indicators.categoryCount}
                          </p>
                        </div>
                        <div>
                          <p style={{ color: '#666', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>60-Day Views</p>
                          <p style={{ color: '#aa44ff', fontSize: '24px', margin: '5px 0' }}>
                            {indicators.totalViews.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Radar Chart */}
                    <div style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                      padding: '30px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center'
                    }}>
                      <h3 style={{ color: '#888', fontWeight: 400, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '20px' }}>
                        Hegemonic Profile
                      </h3>
                      <RadarChart data={indicators} />
                    </div>

                    {/* Score Cards */}
                    <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                      {[
                        { 
                          label: 'Canonization Score', 
                          value: indicators.canonizationScore, 
                          color: '#00ff88',
                          desc: 'How established/authoritative is this knowledge?'
                        },
                        { 
                          label: 'Contestation Score', 
                          value: indicators.contestationScore, 
                          color: '#ff4444',
                          desc: 'How disputed/contested is this knowledge?'
                        },
                        { 
                          label: 'Status Score', 
                          value: indicators.statusScore, 
                          color: '#4488ff',
                          desc: 'How much cultural importance/attention?'
                        }
                      ].map(score => (
                        <div key={score.label} style={{
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '12px',
                          padding: '25px'
                        }}>
                          <p style={{ color: '#666', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>
                            {score.label}
                          </p>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px' }}>
                            <span style={{ color: score.color, fontSize: '48px', fontWeight: 300 }}>
                              {score.value}
                            </span>
                            <span style={{ color: '#666', fontSize: '14px' }}>/100</span>
                          </div>
                          <div style={{
                            marginTop: '15px',
                            height: '4px',
                            background: 'rgba(255,255,255,0.1)',
                            borderRadius: '2px',
                            overflow: 'hidden'
                          }}>
                            <div style={{
                              width: `${score.value}%`,
                              height: '100%',
                              background: score.color,
                              borderRadius: '2px'
                            }} />
                          </div>
                          <p style={{ color: '#555', fontSize: '11px', marginTop: '15px', lineHeight: 1.5 }}>
                            {score.desc}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Edits Tab */}
                {activeTab === 'edits' && (
                  <div>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: '20px',
                      marginBottom: '30px'
                    }}>
                      <div style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        padding: '20px'
                      }}>
                        <p style={{ color: '#666', fontSize: '11px', textTransform: 'uppercase' }}>Unique Editors</p>
                        <p style={{ color: '#00ff88', fontSize: '32px', margin: '10px 0' }}>{indicators.uniqueEditors}</p>
                      </div>
                      <div style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        padding: '20px'
                      }}>
                        <p style={{ color: '#666', fontSize: '11px', textTransform: 'uppercase' }}>Avg Edit Size</p>
                        <p style={{ color: '#ffaa00', fontSize: '32px', margin: '10px 0' }}>{indicators.avgEditSize} bytes</p>
                      </div>
                      <div style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        padding: '20px'
                      }}>
                        <p style={{ color: '#666', fontSize: '11px', textTransform: 'uppercase' }}>Reverts Detected</p>
                        <p style={{ color: '#ff4444', fontSize: '32px', margin: '10px 0' }}>{indicators.revertCount}</p>
                      </div>
                      <div style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        padding: '20px'
                      }}>
                        <p style={{ color: '#666', fontSize: '11px', textTransform: 'uppercase' }}>Recent Edits</p>
                        <p style={{ color: '#4488ff', fontSize: '32px', margin: '10px 0' }}>{editHistory.length}</p>
                      </div>
                    </div>

                    <h3 style={{ color: '#888', fontWeight: 400, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '15px' }}>
                      Recent Edit History
                    </h3>
                    <div style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                      overflow: 'hidden'
                    }}>
                      {editHistory.slice(0, 20).map((edit, i) => {
                        const isRevert = edit.comment?.toLowerCase().includes('revert') || 
                                        edit.comment?.toLowerCase().includes('undid');
                        return (
                          <div key={i} style={{
                            padding: '15px 20px',
                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                            display: 'grid',
                            gridTemplateColumns: '150px 120px 1fr',
                            gap: '20px',
                            alignItems: 'center',
                            background: isRevert ? 'rgba(255, 68, 68, 0.05)' : 'transparent'
                          }}>
                            <span style={{ color: '#666', fontSize: '12px' }}>
                              {new Date(edit.timestamp).toLocaleDateString()}
                            </span>
                            <span style={{ color: '#00ff88', fontSize: '12px' }}>
                              {edit.user?.slice(0, 15)}
                            </span>
                            <span style={{ 
                              color: isRevert ? '#ff4444' : '#888', 
                              fontSize: '12px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {edit.comment || '(no comment)'}
                              {isRevert && <span style={{ marginLeft: '10px', color: '#ff4444' }}>⚠ REVERT</span>}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Views Tab */}
                {activeTab === 'views' && (
                  <div>
                    <div style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                      padding: '30px',
                      marginBottom: '30px'
                    }}>
                      <h3 style={{ color: '#888', fontWeight: 400, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '20px' }}>
                        Page Views (Last 60 Days)
                      </h3>
                      <ViewsChart data={pageViews} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                      <div style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '12px',
                        padding: '25px'
                      }}>
                        <p style={{ color: '#666', fontSize: '11px', textTransform: 'uppercase' }}>Total Views</p>
                        <p style={{ color: '#00ff88', fontSize: '36px', margin: '10px 0' }}>
                          {indicators.totalViews.toLocaleString()}
                        </p>
                      </div>
                      <div style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '12px',
                        padding: '25px'
                      }}>
                        <p style={{ color: '#666', fontSize: '11px', textTransform: 'uppercase' }}>Daily Average</p>
                        <p style={{ color: '#ffaa00', fontSize: '36px', margin: '10px 0' }}>
                          {pageViews?.length > 0 ? Math.round(indicators.totalViews / pageViews.length).toLocaleString() : 0}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Talk Tab */}
                {activeTab === 'talk' && (
                  <div>
                    <div style={{
                      background: talkPage ? 'rgba(255, 170, 0, 0.1)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${talkPage ? 'rgba(255, 170, 0, 0.3)' : 'rgba(255,255,255,0.1)'}`,
                      borderRadius: '12px',
                      padding: '30px',
                      marginBottom: '30px'
                    }}>
                      <h3 style={{ color: '#ffaa00', fontWeight: 400, fontSize: '18px', marginBottom: '10px' }}>
                        Talk Page Analysis
                      </h3>
                      <p style={{ color: '#888', lineHeight: 1.6 }}>
                        Talk pages reveal norm formation and editorial disputes. High activity indicates 
                        contested knowledge where multiple perspectives compete for legitimacy.
                      </p>
                      <div style={{ marginTop: '20px' }}>
                        <span style={{ color: '#666', fontSize: '12px' }}>Talk page edits: </span>
                        <span style={{ color: '#ffaa00', fontSize: '24px', marginLeft: '10px' }}>
                          {indicators.talkPageActivity}
                        </span>
                      </div>
                    </div>

                    {talkPage?.revisions && (
                      <div style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '12px',
                        overflow: 'hidden'
                      }}>
                        <h4 style={{ 
                          padding: '20px', 
                          margin: 0, 
                          borderBottom: '1px solid rgba(255,255,255,0.1)',
                          color: '#888',
                          fontSize: '12px',
                          textTransform: 'uppercase',
                          letterSpacing: '2px'
                        }}>
                          Recent Talk Page Activity
                        </h4>
                        {talkPage.revisions.slice(0, 15).map((edit, i) => (
                          <div key={i} style={{
                            padding: '15px 20px',
                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                            display: 'grid',
                            gridTemplateColumns: '150px 120px 1fr',
                            gap: '20px'
                          }}>
                            <span style={{ color: '#666', fontSize: '12px' }}>
                              {new Date(edit.timestamp).toLocaleDateString()}
                            </span>
                            <span style={{ color: '#ffaa00', fontSize: '12px' }}>
                              {edit.user?.slice(0, 15)}
                            </span>
                            <span style={{ color: '#888', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {edit.comment || '(no comment)'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Signals Tab */}
                {activeTab === 'signals' && (
                  <div>
                    <div style={{
                      background: 'rgba(0, 255, 136, 0.05)',
                      border: '1px solid rgba(0, 255, 136, 0.2)',
                      borderRadius: '12px',
                      padding: '30px',
                      marginBottom: '30px'
                    }}>
                      <h3 style={{ color: '#00ff88', fontSize: '18px', fontWeight: 400, marginBottom: '15px' }}>
                        Hegemonic Signal Interpretation
                      </h3>
                      <p style={{ color: '#888', lineHeight: 1.8, fontSize: '14px' }}>
                        This analysis reveals how cultural power operates through Wikipedia's collaborative knowledge production.
                      </p>
                    </div>

                    <div style={{ display: 'grid', gap: '20px' }}>
                      {/* Language Drift */}
                      <div style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '12px',
                        padding: '25px'
                      }}>
                        <h4 style={{ color: '#00ff88', fontSize: '14px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '20px' }}>📊</span> Language Drift
                        </h4>
                        <p style={{ color: '#888', fontSize: '13px', lineHeight: 1.7 }}>
                          With <strong style={{ color: '#fff' }}>{indicators.langCount} language versions</strong>, 
                          this article shows {indicators.langCount > 50 ? 'strong global' : indicators.langCount > 20 ? 'moderate' : 'limited'} reach. 
                          Translation patterns reveal which concepts gain universal currency vs. remain culturally specific.
                        </p>
                      </div>

                      {/* Norm Formation */}
                      <div style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '12px',
                        padding: '25px'
                      }}>
                        <h4 style={{ color: '#ffaa00', fontSize: '14px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '20px' }}>⚖️</span> Norm Formation
                        </h4>
                        <p style={{ color: '#888', fontSize: '13px', lineHeight: 1.7 }}>
                          {indicators.revertCount > 5 
                            ? `High revert activity (${indicators.revertCount} detected) indicates active norm contestation. Different groups are competing to define what counts as legitimate knowledge.`
                            : indicators.revertCount > 0 
                              ? `Some revert activity (${indicators.revertCount} detected) suggests moderate editorial disputes. Norms are largely established but periodically challenged.`
                              : 'Low revert activity suggests established consensus. Norms have stabilized, possibly indicating hegemonic closure.'}
                        </p>
                      </div>

                      {/* Status */}
                      <div style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '12px',
                        padding: '25px'
                      }}>
                        <h4 style={{ color: '#4488ff', fontSize: '14px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '20px' }}>👁️</span> Status & Attention
                        </h4>
                        <p style={{ color: '#888', fontSize: '13px', lineHeight: 1.7 }}>
                          {indicators.totalViews > 100000 
                            ? `High attention topic (${indicators.totalViews.toLocaleString()} views in 60 days). This subject commands significant cultural mindshare.`
                            : indicators.totalViews > 10000
                              ? `Moderate attention (${indicators.totalViews.toLocaleString()} views). This subject has notable but not dominant cultural presence.`
                              : `Lower attention (${indicators.totalViews.toLocaleString()} views). This may be specialized knowledge or emerging topic.`}
                        </p>
                      </div>

                      {/* Mockery/Contestation */}
                      <div style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '12px',
                        padding: '25px'
                      }}>
                        <h4 style={{ color: '#ff4444', fontSize: '14px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '20px' }}>🎭</span> Contestation Index
                        </h4>
                        <p style={{ color: '#888', fontSize: '13px', lineHeight: 1.7 }}>
                          Contestation score of <strong style={{ color: '#ff4444' }}>{indicators.contestationScore}/100</strong>. 
                          {indicators.contestationScore > 50 
                            ? ' This topic is actively disputed. Multiple narratives compete for dominance, suggesting ongoing hegemonic struggle.'
                            : indicators.contestationScore > 25
                              ? ' Moderate contestation. Some disagreement exists but dominant narratives are largely stable.'
                              : ' Low contestation suggests either genuine consensus or successful hegemonic closure where alternatives have been marginalized.'}
                        </p>
                      </div>

                      {/* Canonization */}
                      <div style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '12px',
                        padding: '25px'
                      }}>
                        <h4 style={{ color: '#aa44ff', fontSize: '14px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '20px' }}>📚</span> Canonization Analysis
                        </h4>
                        <p style={{ color: '#888', fontSize: '13px', lineHeight: 1.7 }}>
                          Canonization score of <strong style={{ color: '#aa44ff' }}>{indicators.canonizationScore}/100</strong>.
                          {indicators.canonizationScore > 70 
                            ? ' Highly canonized knowledge—extensively documented, widely translated, and frequently referenced. This represents established cultural capital.'
                            : indicators.canonizationScore > 40
                              ? ' Moderately canonized. The knowledge is recognized but may lack the deep institutional embedding of core cultural topics.'
                              : ' Lower canonization suggests emerging, specialized, or marginalized knowledge that has yet to achieve broad legitimacy.'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Trending Sidebar */}
          {articleData && !articleData.error && (
            <aside style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px',
              padding: '20px',
              height: 'fit-content',
              position: 'sticky',
              top: '120px'
            }}>
              <h3 style={{ 
                color: '#888', 
                fontSize: '11px', 
                textTransform: 'uppercase', 
                letterSpacing: '2px',
                marginBottom: '15px'
              }}>
                🔥 Active Edit Zones
              </h3>
              <p style={{ color: '#555', fontSize: '11px', marginBottom: '15px' }}>
                Currently contested topics (by recent edit frequency)
              </p>
              {trendingTopics.map((topic, i) => (
                <button
                  key={i}
                  onClick={() => { setSearchTerm(topic.title); analyzeArticle(topic.title); }}
                  style={{
                    display: 'block',
                    width: '100%',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    marginBottom: '8px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <span style={{ color: '#ccc', fontSize: '12px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {topic.title}
                  </span>
                  <span style={{ color: '#00ff88', fontSize: '10px' }}>
                    {topic.editCount} recent edits
                  </span>
                </button>
              ))}
              <button
                onClick={fetchTrendingTopics}
                style={{
                  marginTop: '10px',
                  width: '100%',
                  background: 'transparent',
                  border: '1px solid rgba(0, 255, 136, 0.3)',
                  borderRadius: '6px',
                  padding: '8px',
                  color: '#00ff88',
                  fontSize: '11px',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '1px'
                }}
              >
                Refresh
              </button>
            </aside>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid rgba(255,255,255,0.05)',
        padding: '20px 40px',
        textAlign: 'center',
        marginTop: '60px'
      }}>
        <p style={{ color: '#444', fontSize: '11px', letterSpacing: '1px' }}>
          HEGEMONIC RADAR • Analyzing cultural power through collaborative knowledge • Wikipedia API
        </p>
        <p style={{ color: '#333', fontSize: '10px', marginTop: '10px' }}>
          Tracks: Language Drift • Norm Formation • Status • Contestation • Canonization
        </p>
      </footer>
    </div>
  );
};

export default WikipediaHegemonicRadar;
