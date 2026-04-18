import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/dashboard/dashboard.component').then(
        (m) => m.DashboardComponent,
      ),
    title: 'Live Dashboard · Vigilant Architect',
  },
  {
    path: 'incidents',
    loadComponent: () =>
      import('./pages/incidents/incidents-list.component').then(
        (m) => m.IncidentsListComponent,
      ),
    title: 'Incidents · Vigilant Architect',
  },
  {
    path: 'incidents/:id',
    loadComponent: () =>
      import('./pages/incidents/incident-detail.component').then(
        (m) => m.IncidentDetailComponent,
      ),
    title: 'Incident · Vigilant Architect',
  },
  {
    path: 'venue-map',
    loadComponent: () =>
      import('./pages/venue-map/venue-map.page').then(
        (m) => m.VenueMapPageComponent,
      ),
    title: 'Venue Map · Vigilant Architect',
  },
  {
    path: 'reports',
    loadComponent: () =>
      import('./pages/reports/reports-list.component').then(
        (m) => m.ReportsListComponent,
      ),
    title: 'Reports · Vigilant Architect',
  },
  {
    path: 'reports/:id',
    loadComponent: () =>
      import('./pages/reports/report-detail.component').then(
        (m) => m.ReportDetailComponent,
      ),
    title: 'Report · Vigilant Architect',
  },
  {
    path: 'escalate',
    loadComponent: () =>
      import('./pages/escalate/escalate.component').then(
        (m) => m.EscalateComponent,
      ),
    title: 'Escalate · Vigilant Architect',
  },
  {
    path: 'staff',
    loadComponent: () =>
      import('./pages/staff/staff-list.component').then(
        (m) => m.StaffListComponent,
      ),
    title: 'Staff Roster · Vigilant Architect',
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./pages/settings/settings.component').then(
        (m) => m.SettingsComponent,
      ),
    title: 'Settings · Vigilant Architect',
  },
  { path: '**', redirectTo: '' },
];
