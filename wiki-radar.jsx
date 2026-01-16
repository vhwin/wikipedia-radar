import React, { useState, useEffect, useCallback } from 'react';

const WikiRadar = () => {
  const [recentChanges, setRecentChanges] = useState([]);
  const [contestedTopics, setContestedTopics] = useState([]);
  const [editWars, setEditWars] = useState([]);
  const [trendingByViews, setTrendingByViews] = useState([]);
  const [hotCategories, setHotCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [topicDetails, setTopicDetails] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [timeRange, setTimeRange] = useState('1h');

  // Fetch all trending data
  const fetchTrendingData = useCallback(async () => {
    setLoading(true);
    
    try {
      // 1. Fetch recent changes (last 500 edits)
      const rcLimit = timeRange === '1h' ? 500 : timeRange === '6h' ? 500 : 500;
      const rcResponse = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&list=recentchanges&rcnamespace=0&rclimit=${rcLimit}&rctype=edit&rcprop=title|timestamp|user|comment|sizes|flags&format=json&origin=*`
      );
      const rcData = await rcResponse.json();
      const changes = rcData.query.recentchanges;
      setRecentChanges(changes);

      // 2. Analyze for contested topics (multiple edits to same article)
      const editCounts = {};
      const editorsByArticle = {};
      const revertsByArticle = {};
      const sizeChangesByArticle = {};
      
      changes.forEach(change => {
        const title = change.title;
        
        // Count edits
        editCounts[title] = (editCounts[title] || 0) + 1;
        
        // Track unique editors
        if (!editorsByArticle[title]) editorsByArticle[title] = new Set();
        editorsByArticle[title].add(change.user);
        
        // Detect reverts
        const comment = (change.comment || '').toLowerCase();
        if (comment.includes('revert') || comment.includes('undid') || comment.includes('rv ') || comment.includes('rvv')) {
          revertsByArticle[title] = (revertsByArticle[title] || 0) + 1;
        }
        
        // Track size changes
        const sizeChange = Math.abs((change.newlen || 0) - (change.oldlen || 0));
        sizeChangesByArticle[title] = (sizeChangesByArticle[title] || 0) + sizeChange;
      });

      // 3. Calculate contestation scores
      const contestedList = Object.entries(editCounts)
        .map(([title, count]) => {
          const editors = editorsByArticle[title]?.size || 1;
          const reverts = revertsByArticle[title] || 0;
          const sizeChurn = sizeChangesByArticle[title] || 0;
          
          // Contestation formula: edits * editor_diversity * (1 + reverts*3)
          const contestationScore = count * Math.sqrt(editors) * (1 + reverts * 3);
          
          return {
            title,
            editCount: count,
            uniqueEditors: editors,
            revertCount: reverts,
            sizeChurn,
            contestationScore,
            isEditWar: reverts >= 2 || (count >= 5 && editors >= 3)
          };
        })
        .filter(t => t.editCount >= 2)
        .sort((a, b) => b.contestationScore - a.contestationScore)
        .slice(0, 30);

      setContestedTopics(contestedList);
      
      // 4. Extract edit wars specifically
      const wars = contestedList.filter(t => t.isEditWar);
      setEditWars(wars);

      // 5. Fetch today's most viewed articles
      const today = new Date();
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
      const dateStr = `${yesterday.getFullYear()}/${String(yesterday.getMonth() + 1).padStart(2, '0')}/${String(yesterday.getDate()).padStart(2, '0')}`;
      
      try {
        const viewsResponse = await fetch(
          `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access/${dateStr}`
        );
        const viewsData = await viewsResponse.json();
        
        // Filter out main page and special pages
        const topViewed = (viewsData.items?.[0]?.articles || [])
          .filter(a => !a.article.includes(':') && a.article !== 'Main_Page')
          .slice(0, 20)
          .map(a => ({
            title: a.article.replace(/_/g, ' '),
            views: a.views,
            rank: a.rank,
            // Check if also being edited
            isContested: editCounts[a.article.replace(/_/g, ' ')] >= 2
          }));
        
        setTrendingByViews(topViewed);
      } catch (e) {
        console.error('Views API error:', e);
      }

      // 6. Categorize hot topics
      const categories = {
        'Politics & Governance': [],
        'Science & Technology': [],
        'Culture & Society': [],
        'People & Biography': [],
        'Current Events': [],
        'Other': []
      };
      
      // Simple keyword categorization
      contestedList.forEach(topic => {
        const title = topic.title.toLowerCase();
        if (title.includes('election') || title.includes('president') || title.includes('government') || 
            title.includes('party') || title.includes('minister') || title.includes('congress') ||
            title.includes('senate') || title.includes('law') || title.includes('political')) {
          categories['Politics & Governance'].push(topic);
        } else if (title.includes('ai') || title.includes('technology') || title.includes('software') ||
                   title.includes('science') || title.includes('research') || title.includes('study') ||
                   title.includes('climate') || title.includes('medical') || title.includes('vaccine')) {
          categories['Science & Technology'].push(topic);
        } else if (title.includes('film') || title.includes('album') || title.includes('series') ||
                   title.includes('show') || title.includes('music') || title.includes('art') ||
                   title.includes('culture') || title.includes('religion') || title.includes('sport')) {
          categories['Culture & Society'].push(topic);
        } else if (title.match(/^[A-Z][a-z]+ [A-Z][a-z]+$/) || title.includes('death of') ||
                   title.includes('biography')) {
          categories['People & Biography'].push(topic);
        } else if (title.includes('2024') || title.includes('2025') || title.includes('attack') ||
                   title.includes('earthquake') || title.includes('storm') || title.includes('shooting')) {
          categories['Current Events'].push(topic);
        } else {
          categories['Other'].push(topic);
        }
      });
      
      const hotCats = Object.entries(categories)
        .map(([name, topics]) => ({
          name,
          count: topics.length,
          topics: topics.slice(0, 5),
          totalContestationScore: topics.reduce((sum, t) => sum + t.contestationScore, 0)
        }))
        .filter(c => c.count > 0)
        .sort((a, b) => b.totalContestationScore - a.totalContestationScore);
      
      setHotCategories(hotCats);
      setLastUpdate(new Date());
      
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    
    setLoading(false);
  }, [timeRange]);

  // Initial load and auto-refresh
  useEffect(() => {
    fetchTrendingData();
    const interval = setInterval(fetchTrendingData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [fetchTrendingData]);

  // Fetch details for selected topic
  const fetchTopicDetails = async (title) => {
    setSelectedTopic(title);
    setTopicDetails(null);
    
    try {
      // Get article info and recent revisions
      const response = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=info|revisions|categories|langlinks&rvprop=timestamp|user|comment|size&rvlimit=30&lllimit=50&cllimit=20&format=json&origin=*`
      );
      const data = await response.json();
      const pages = data.query.pages;
      const page = pages[Object.keys(pages)[0]];
      
      // Get page views
      const today = new Date();
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      const formatDate = (d) => d.toISOString().split('T')[0].replace(/-/g, '');
      
      let viewsData = [];
      try {
        const viewsResponse = await fetch(
          `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/all-agents/${encodeURIComponent(title.replace(/ /g, '_'))}/daily/${formatDate(thirtyDaysAgo)}/${formatDate(today)}`
        );
        const views = await viewsResponse.json();
        viewsData = views.items || [];
      } catch (e) {}
      
      setTopicDetails({
        ...page,
        pageViews: viewsData,
        totalViews: viewsData.reduce((sum, d) => sum + d.views, 0)
      });
      
    } catch (error) {
      console.error('Error fetching topic details:', error);
    }
  };

  // Filter topics based on active filter
  const getFilteredTopics = () => {
    switch (activeFilter) {
      case 'editwars':
        return editWars;
      case 'highchurn':
        return contestedTopics.filter(t => t.sizeChurn > 5000);
      case 'multieditor':
        return contestedTopics.filter(t => t.uniqueEditors >= 3);
      default:
        return contestedTopics;
    }
  };

  const StatCard = ({ label, value, subtext, color, icon }) => (
    <div style={{
      background: 'rgba(0,0,0,0.3)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '8px',
      padding: '20px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute',
        top: '10px',
        right: '15px',
        fontSize: '28px',
        opacity: 0.3
      }}>{icon}</div>
      <p style={{ 
        color: '#666', 
        fontSize: '10px', 
        textTransform: 'uppercase', 
        letterSpacing: '1.5px',
        margin: '0 0 8px 0'
      }}>{label}</p>
      <p style={{ 
        color: color, 
        fontSize: '32px', 
        fontWeight: '300',
        margin: '0',
        fontFamily: "'Space Mono', monospace"
      }}>{value}</p>
      {subtext && (
        <p style={{ color: '#555', fontSize: '11px', margin: '8px 0 0' }}>{subtext}</p>
      )}
    </div>
  );

  const TopicRow = ({ topic, rank }) => (
    <div 
      onClick={() => fetchTopicDetails(topic.title)}
      style={{
        display: 'grid',
        gridTemplateColumns: '40px 1fr 80px 80px 80px 100px',
        gap: '15px',
        padding: '14px 20px',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        cursor: 'pointer',
        transition: 'background 0.2s',
        alignItems: 'center',
        background: topic.isEditWar ? 'rgba(255, 59, 48, 0.08)' : 'transparent'
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
      onMouseLeave={(e) => e.currentTarget.style.background = topic.isEditWar ? 'rgba(255, 59, 48, 0.08)' : 'transparent'}
    >
      <span style={{ 
        color: rank <= 3 ? '#ff3b30' : rank <= 10 ? '#ff9500' : '#666',
        fontSize: '14px',
        fontWeight: rank <= 3 ? '600' : '400'
      }}>
        #{rank}
      </span>
      <div>
        <span style={{ color: '#e0e0e0', fontSize: '14px' }}>{topic.title}</span>
        {topic.isEditWar && (
          <span style={{
            marginLeft: '10px',
            background: 'rgba(255, 59, 48, 0.2)',
            color: '#ff3b30',
            padding: '2px 8px',
            borderRadius: '3px',
            fontSize: '9px',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}>Edit War</span>
        )}
      </div>
      <span style={{ color: '#30d158', fontSize: '13px', textAlign: 'center' }}>
        {topic.editCount} edits
      </span>
      <span style={{ color: '#5e5ce6', fontSize: '13px', textAlign: 'center' }}>
        {topic.uniqueEditors} editors
      </span>
      <span style={{ color: topic.revertCount > 0 ? '#ff3b30' : '#444', fontSize: '13px', textAlign: 'center' }}>
        {topic.revertCount} reverts
      </span>
      <div style={{ textAlign: 'right' }}>
        <div style={{
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '4px',
          height: '6px',
          width: '100%',
          overflow: 'hidden'
        }}>
          <div style={{
            height: '100%',
            width: `${Math.min(100, topic.contestationScore / 2)}%`,
            background: topic.contestationScore > 50 ? '#ff3b30' : topic.contestationScore > 20 ? '#ff9500' : '#30d158',
            borderRadius: '4px'
          }} />
        </div>
        <span style={{ fontSize: '10px', color: '#666', marginTop: '4px', display: 'block' }}>
          {Math.round(topic.contestationScore)}
        </span>
      </div>
    </div>
  );

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0c',
      color: '#e0e0e0',
      fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif"
    }}>
      {/* Header */}
      <header style={{
        background: 'linear-gradient(180deg, rgba(20,20,25,0.98) 0%, rgba(10,10,12,0.95) 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '20px 40px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backdropFilter: 'blur(20px)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: '26px',
              fontWeight: 600,
              color: '#fff',
              letterSpacing: '-0.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <span style={{ 
                background: 'linear-gradient(135deg, #ff3b30, #ff9500)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>📡</span>
              Wiki Radar
            </h1>
            <p style={{ 
              margin: '4px 0 0', 
              fontSize: '12px', 
              color: '#666',
              letterSpacing: '0.5px'
            }}>
              Tracking Wikipedia Cultural Wars
            </p>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            {/* Time Range Selector */}
            <div style={{ display: 'flex', gap: '5px' }}>
              {[
                { value: '1h', label: '1H' },
                { value: '6h', label: '6H' },
                { value: '24h', label: '24H' }
              ].map(t => (
                <button
                  key={t.value}
                  onClick={() => setTimeRange(t.value)}
                  style={{
                    background: timeRange === t.value ? 'rgba(255,255,255,0.1)' : 'transparent',
                    border: '1px solid rgba(255,255,255,0.1)',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    color: timeRange === t.value ? '#fff' : '#666',
                    fontSize: '11px',
                    cursor: 'pointer',
                    fontWeight: 500
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
            
            {/* Refresh Button */}
            <button
              onClick={fetchTrendingData}
              disabled={loading}
              style={{
                background: loading ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #ff3b30, #ff9500)',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '8px',
                color: loading ? '#666' : '#fff',
                fontSize: '12px',
                fontWeight: 600,
                cursor: loading ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {loading ? (
                <>
                  <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
                  Scanning...
                </>
              ) : (
                <>⟳ Refresh</>
              )}
            </button>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            
            {lastUpdate && (
              <span style={{ color: '#444', fontSize: '11px' }}>
                Updated {lastUpdate.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      </header>

      <main style={{ padding: '30px 40px', maxWidth: '1800px', margin: '0 auto' }}>
        {/* Stats Overview */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '15px',
          marginBottom: '30px'
        }}>
          <StatCard 
            label="Active Edit Wars"
            value={editWars.length}
            subtext="Topics with ≥2 reverts"
            color="#ff3b30"
            icon="⚔️"
          />
          <StatCard 
            label="Contested Topics"
            value={contestedTopics.length}
            subtext="Multiple recent edits"
            color="#ff9500"
            icon="🔥"
          />
          <StatCard 
            label="Unique Editors"
            value={new Set(recentChanges.map(c => c.user)).size}
            subtext="Active contributors"
            color="#5e5ce6"
            icon="👥"
          />
          <StatCard 
            label="Total Edits"
            value={recentChanges.length}
            subtext={`Last ${timeRange}`}
            color="#30d158"
            icon="✏️"
          />
          <StatCard 
            label="Bytes Changed"
            value={`${(recentChanges.reduce((sum, c) => sum + Math.abs((c.newlen || 0) - (c.oldlen || 0)), 0) / 1024).toFixed(0)}K`}
            subtext="Content churn"
            color="#bf5af2"
            icon="📊"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '30px' }}>
          {/* Main Content */}
          <div>
            {/* Filter Tabs */}
            <div style={{
              display: 'flex',
              gap: '10px',
              marginBottom: '20px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              paddingBottom: '15px'
            }}>
              {[
                { key: 'all', label: 'All Contested', count: contestedTopics.length },
                { key: 'editwars', label: 'Edit Wars', count: editWars.length },
                { key: 'highchurn', label: 'High Churn', count: contestedTopics.filter(t => t.sizeChurn > 5000).length },
                { key: 'multieditor', label: 'Multi-Editor', count: contestedTopics.filter(t => t.uniqueEditors >= 3).length }
              ].map(filter => (
                <button
                  key={filter.key}
                  onClick={() => setActiveFilter(filter.key)}
                  style={{
                    background: activeFilter === filter.key ? 'rgba(255, 149, 0, 0.15)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${activeFilter === filter.key ? 'rgba(255, 149, 0, 0.3)' : 'rgba(255,255,255,0.06)'}`,
                    padding: '10px 16px',
                    borderRadius: '8px',
                    color: activeFilter === filter.key ? '#ff9500' : '#888',
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  {filter.label}
                  <span style={{
                    background: activeFilter === filter.key ? 'rgba(255, 149, 0, 0.2)' : 'rgba(255,255,255,0.1)',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontSize: '11px'
                  }}>
                    {filter.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Contested Topics Table */}
            <div style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '12px',
              overflow: 'hidden'
            }}>
              {/* Table Header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '40px 1fr 80px 80px 80px 100px',
                gap: '15px',
                padding: '12px 20px',
                background: 'rgba(0,0,0,0.3)',
                borderBottom: '1px solid rgba(255,255,255,0.06)'
              }}>
                <span style={{ color: '#555', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Rank</span>
                <span style={{ color: '#555', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Article</span>
                <span style={{ color: '#555', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'center' }}>Edits</span>
                <span style={{ color: '#555', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'center' }}>Editors</span>
                <span style={{ color: '#555', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'center' }}>Reverts</span>
                <span style={{ color: '#555', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', textAlign: 'right' }}>Score</span>
              </div>
              
              {/* Table Body */}
              {loading ? (
                <div style={{ padding: '60px', textAlign: 'center' }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    border: '3px solid rgba(255, 149, 0, 0.2)',
                    borderTop: '3px solid #ff9500',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                    margin: '0 auto 15px'
                  }} />
                  <p style={{ color: '#666' }}>Scanning recent changes...</p>
                </div>
              ) : getFilteredTopics().length === 0 ? (
                <div style={{ padding: '60px', textAlign: 'center', color: '#555' }}>
                  No contested topics found with current filter
                </div>
              ) : (
                getFilteredTopics().map((topic, i) => (
                  <TopicRow key={topic.title} topic={topic} rank={i + 1} />
                ))
              )}
            </div>

            {/* Hot Categories */}
            <div style={{ marginTop: '30px' }}>
              <h3 style={{ 
                color: '#888', 
                fontSize: '11px', 
                textTransform: 'uppercase', 
                letterSpacing: '2px',
                marginBottom: '15px'
              }}>
                Contested by Category
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' }}>
                {hotCategories.map(cat => (
                  <div key={cat.name} style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '10px',
                    padding: '18px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ color: '#fff', fontSize: '13px', fontWeight: 500 }}>{cat.name}</span>
                      <span style={{
                        background: 'rgba(255, 149, 0, 0.15)',
                        color: '#ff9500',
                        padding: '3px 10px',
                        borderRadius: '12px',
                        fontSize: '11px'
                      }}>
                        {cat.count} topics
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {cat.topics.map(t => (
                        <div 
                          key={t.title}
                          onClick={() => fetchTopicDetails(t.title)}
                          style={{
                            fontSize: '12px',
                            color: '#888',
                            cursor: 'pointer',
                            padding: '4px 0',
                            borderBottom: '1px solid rgba(255,255,255,0.03)',
                            display: 'flex',
                            justifyContent: 'space-between'
                          }}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                            {t.title}
                          </span>
                          <span style={{ color: '#555' }}>{t.editCount} edits</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Topic Details Panel */}
            {selectedTopic && (
              <div style={{
                background: 'linear-gradient(180deg, rgba(255, 149, 0, 0.08) 0%, rgba(255, 59, 48, 0.05) 100%)',
                border: '1px solid rgba(255, 149, 0, 0.2)',
                borderRadius: '12px',
                padding: '20px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                  <h3 style={{ color: '#fff', fontSize: '16px', fontWeight: 500, margin: 0, lineHeight: 1.3 }}>
                    {selectedTopic}
                  </h3>
                  <button
                    onClick={() => setSelectedTopic(null)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#666',
                      cursor: 'pointer',
                      fontSize: '18px',
                      padding: '0'
                    }}
                  >×</button>
                </div>
                
                {topicDetails ? (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '15px' }}>
                      <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '12px' }}>
                        <p style={{ color: '#666', fontSize: '10px', textTransform: 'uppercase', margin: '0 0 5px' }}>30-Day Views</p>
                        <p style={{ color: '#30d158', fontSize: '20px', margin: 0 }}>
                          {topicDetails.totalViews?.toLocaleString() || 'N/A'}
                        </p>
                      </div>
                      <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '12px' }}>
                        <p style={{ color: '#666', fontSize: '10px', textTransform: 'uppercase', margin: '0 0 5px' }}>Languages</p>
                        <p style={{ color: '#5e5ce6', fontSize: '20px', margin: 0 }}>
                          {topicDetails.langlinks?.length || 0}
                        </p>
                      </div>
                    </div>
                    
                    <h4 style={{ color: '#888', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', margin: '15px 0 10px' }}>
                      Recent Edits
                    </h4>
                    <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                      {topicDetails.revisions?.slice(0, 10).map((rev, i) => {
                        const isRevert = rev.comment?.toLowerCase().includes('revert') || rev.comment?.toLowerCase().includes('undid');
                        return (
                          <div key={i} style={{
                            padding: '8px 0',
                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                            background: isRevert ? 'rgba(255, 59, 48, 0.1)' : 'transparent',
                            marginLeft: '-10px',
                            marginRight: '-10px',
                            paddingLeft: '10px',
                            paddingRight: '10px'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                              <span style={{ color: '#ff9500' }}>{rev.user?.slice(0, 20)}</span>
                              <span style={{ color: '#555' }}>{new Date(rev.timestamp).toLocaleDateString()}</span>
                            </div>
                            <p style={{ 
                              color: isRevert ? '#ff3b30' : '#666', 
                              fontSize: '11px', 
                              margin: '4px 0 0',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {rev.comment || '(no comment)'}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                    
                    <a
                      href={`https://en.wikipedia.org/wiki/${encodeURIComponent(selectedTopic)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'block',
                        marginTop: '15px',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        padding: '10px',
                        borderRadius: '6px',
                        color: '#888',
                        textDecoration: 'none',
                        fontSize: '12px',
                        textAlign: 'center'
                      }}
                    >
                      View on Wikipedia →
                    </a>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '30px' }}>
                    <div style={{
                      width: '30px',
                      height: '30px',
                      border: '2px solid rgba(255, 149, 0, 0.2)',
                      borderTop: '2px solid #ff9500',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                      margin: '0 auto'
                    }} />
                  </div>
                )}
              </div>
            )}

            {/* Trending by Views */}
            <div style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '12px',
              padding: '20px'
            }}>
              <h3 style={{ 
                color: '#888', 
                fontSize: '11px', 
                textTransform: 'uppercase', 
                letterSpacing: '2px',
                margin: '0 0 15px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ color: '#5e5ce6' }}>👁️</span> Most Viewed Today
              </h3>
              {trendingByViews.slice(0, 12).map((article, i) => (
                <div
                  key={article.title}
                  onClick={() => fetchTopicDetails(article.title)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                    <span style={{ 
                      color: i < 3 ? '#5e5ce6' : '#444', 
                      fontSize: '12px',
                      width: '20px'
                    }}>
                      {i + 1}
                    </span>
                    <span style={{ 
                      color: '#ccc', 
                      fontSize: '12px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {article.title}
                    </span>
                    {article.isContested && (
                      <span style={{
                        background: 'rgba(255, 59, 48, 0.2)',
                        color: '#ff3b30',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        fontSize: '8px',
                        flexShrink: 0
                      }}>ACTIVE</span>
                    )}
                  </div>
                  <span style={{ color: '#555', fontSize: '11px', flexShrink: 0, marginLeft: '10px' }}>
                    {(article.views / 1000).toFixed(0)}K
                  </span>
                </div>
              ))}
            </div>

            {/* Live Feed */}
            <div style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '12px',
              padding: '20px'
            }}>
              <h3 style={{ 
                color: '#888', 
                fontSize: '11px', 
                textTransform: 'uppercase', 
                letterSpacing: '2px',
                margin: '0 0 15px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ 
                  width: '8px', 
                  height: '8px', 
                  background: '#30d158', 
                  borderRadius: '50%',
                  animation: 'pulse 2s infinite'
                }} />
                Live Edit Feed
                <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
              </h3>
              <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                {recentChanges.slice(0, 20).map((change, i) => {
                  const isRevert = change.comment?.toLowerCase().includes('revert');
                  const sizeChange = (change.newlen || 0) - (change.oldlen || 0);
                  return (
                    <div key={i} style={{
                      padding: '8px 0',
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                      fontSize: '11px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                        <span 
                          style={{ color: '#aaa', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}
                          onClick={() => fetchTopicDetails(change.title)}
                        >
                          {change.title}
                        </span>
                        <span style={{ 
                          color: sizeChange > 0 ? '#30d158' : sizeChange < 0 ? '#ff3b30' : '#555',
                          flexShrink: 0
                        }}>
                          {sizeChange > 0 ? '+' : ''}{sizeChange}
                        </span>
                      </div>
                      <div style={{ color: '#555', display: 'flex', gap: '8px' }}>
                        <span>{change.user?.slice(0, 15)}</span>
                        {isRevert && <span style={{ color: '#ff3b30' }}>⚠ REVERT</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid rgba(255,255,255,0.04)',
        padding: '20px 40px',
        textAlign: 'center',
        marginTop: '40px'
      }}>
        <p style={{ color: '#333', fontSize: '11px' }}>
          Wiki Radar • Real-time Wikipedia cultural war surveillance • Data from MediaWiki API
        </p>
      </footer>
    </div>
  );
};

export default WikiRadar;
