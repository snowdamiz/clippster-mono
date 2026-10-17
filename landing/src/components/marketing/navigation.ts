export const marketingNavigation=[
  {
    "href": "/",
    "label": "Home"
  },
  {
    "href": "/clipping-tool",
    "label": "Clipping Tool"
  },
  {
    "href": "/live-stream-clipping",
    "label": "Live Clipping"
  },
  {
    "href": "/video-editor",
    "label": "Editor"
  },
  {
    "href": "/clipping-campaigns",
    "label": "Campaigns"
  },
  {
    "href": "/vs/opus-clip",
    "label": "Compare"
  },
  {
    "href": "/guides/how-to-clip-twitch-streams",
    "label": "Guides"
  },
  {
    "href": "/pricing",
    "label": "Pricing"
  }
]
const headerDestinations=new Set(marketingNavigation.map(link=>link.href))
export const footerGroups={
  "Workspace": [
    {
      "label": "AI Clipping Tool",
      "href": "/clipping-tool"
    },
    {
      "label": "Live Stream Clipping",
      "href": "/live-stream-clipping"
    },
    {
      "label": "Video Editor",
      "href": "/video-editor"
    },
    {
      "label": "Clipping Campaigns",
      "href": "/clipping-campaigns"
    },
    {
      "label": "For Organizations",
      "href": "/for-organizations"
    },
    {
      "label": "Social Posting",
      "href": "/social-posting"
    },
    {
      "label": "Clip Analytics",
      "href": "/clip-analytics"
    },
    {
      "label": "Design Studio",
      "href": "/design-studio"
    }
  ],
  "Alternatives": [
    {
      "label": "vs Opus Clip",
      "href": "/vs/opus-clip"
    },
    {
      "label": "vs Eklipse",
      "href": "/vs/eklipse"
    },
    {
      "label": "vs Streamladder",
      "href": "/vs/streamladder"
    },
    {
      "label": "vs Medal",
      "href": "/vs/medal"
    },
    {
      "label": "vs Powder",
      "href": "/vs/powder"
    },
    {
      "label": "Pricing",
      "href": "/pricing"
    }
  ],
  "Resources": [
    {
      "label": "Methodology",
      "href": "/methodology"
    },
    {
      "label": "Editorial",
      "href": "/authors/clippster-editorial"
    },
    {
      "label": "Live vs VOD case study",
      "href": "/case-studies/live-clipping-vs-vod-queue"
    },
    {
      "label": "Campaign case study",
      "href": "/case-studies/org-campaign-clipper-workflow"
    },
    {
      "label": "Clippers",
      "href": "/clippers"
    },
    {
      "label": "Organizations",
      "href": "/orgs"
    }
  ]
}
export const footerNavigation=Object.entries(footerGroups).map(([title,links])=>({title,links:links.filter(link=>!headerDestinations.has(link.href))}))
