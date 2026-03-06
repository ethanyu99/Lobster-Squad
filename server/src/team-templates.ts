import type { TeamTemplate } from '../../shared/types';

export const TEAM_TEMPLATES: TeamTemplate[] = [
  {
    id: 'fullstack-dev',
    name: 'Full-Stack Dev',
    description: 'Software development team covering architecture, coding, testing, and code review',
    roles: [
      {
        name: 'Architect',
        description: 'Responsible for system architecture, tech stack selection, and task breakdown as Team Lead',
        capabilities: ['System Design', 'Tech Selection', 'API Design', 'Task Breakdown', 'Architecture Review'],
        isLead: true,
      },
      {
        name: 'Developer',
        description: 'Implements high-quality code based on the architect\'s design',
        capabilities: ['Full-Stack', 'React', 'Node.js', 'TypeScript', 'Database'],
        isLead: false,
      },
      {
        name: 'Tester',
        description: 'Writes unit tests, integration tests, and ensures code quality',
        capabilities: ['Unit Testing', 'Integration Testing', 'E2E Testing', 'Test Strategy', 'Edge Cases'],
        isLead: false,
      },
      {
        name: 'Reviewer',
        description: 'Reviews code quality, security, and performance, provides improvement suggestions',
        capabilities: ['Code Review', 'Performance', 'Security Audit', 'Best Practices', 'Refactoring'],
        isLead: false,
      },
    ],
  },
  {
    id: 'content-creation',
    name: 'Content Team',
    description: 'Content marketing and creation team with user analysis, copywriting, and publishing',
    roles: [
      {
        name: 'Strategist',
        description: 'Defines content strategy, topic planning, and coordinates the team as Lead',
        capabilities: ['Content Strategy', 'Topic Planning', 'Audience Analysis', 'Creative Direction', 'Brand Voice'],
        isLead: true,
      },
      {
        name: 'Analyst',
        description: 'Analyzes target audience personas, preferences, and behavioral data',
        capabilities: ['User Research', 'Data Analysis', 'Persona Building', 'Trend Insights', 'Competitor Analysis'],
        isLead: false,
      },
      {
        name: 'Writer',
        description: 'Creates engaging copy based on audience insights and strategic direction',
        capabilities: ['Copywriting', 'Headline Optimization', 'Storytelling', 'Tone Adaptation', 'Multi-format'],
        isLead: false,
      },
      {
        name: 'Publisher',
        description: 'Adapts content for platform formats and executes publishing strategy',
        capabilities: ['Platform Ops', 'Format Adaptation', 'Publishing Strategy', 'SEO', 'Analytics'],
        isLead: false,
      },
    ],
  },
  {
    id: 'data-analysis',
    name: 'Data Analysis',
    description: 'Data-driven analysis team covering data processing, visualization, and reporting',
    roles: [
      {
        name: 'Lead Analyst',
        description: 'Designs analysis frameworks, defines metrics, and distills conclusions as Team Lead',
        capabilities: ['Analysis Framework', 'Metric Design', 'Business Understanding', 'Hypothesis Testing', 'Insights'],
        isLead: true,
      },
      {
        name: 'Data Analyst',
        description: 'Performs data cleaning, exploratory analysis, and statistical modeling',
        capabilities: ['Data Cleaning', 'Statistical Analysis', 'SQL', 'Python', 'Feature Engineering'],
        isLead: false,
      },
      {
        name: 'Visualizer',
        description: 'Transforms analysis results into intuitive charts and dashboards',
        capabilities: ['Data Visualization', 'Chart Design', 'Dashboard', 'Interactive Design', 'Data Storytelling'],
        isLead: false,
      },
      {
        name: 'Reporter',
        description: 'Compiles analysis insights into structured reports',
        capabilities: ['Report Writing', 'Structured Narrative', 'Executive Summary', 'Recommendations', 'Presentations'],
        isLead: false,
      },
    ],
  },
];
