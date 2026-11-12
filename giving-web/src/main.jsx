import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { OrganizerAuthProvider } from './organizer/AuthContext.jsx';
import { GuestOnly, RequireOrganizer } from './organizer/OrganizerLayout.jsx';
import { LoginPage, RegisterPage } from './organizer/AuthPages.jsx';
import ConsolePage from './organizer/ConsolePage.jsx';
import NewFundraiserPage from './organizer/NewFundraiserPage.jsx';
import GroupWorkspacePage from './organizer/GroupWorkspacePage.jsx';
import { Toaster } from 'react-hot-toast';
import GivingPage from './page.jsx';
import './style.css';
import './organizer/organizer.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <OrganizerAuthProvider>
        <Routes>
          {/* Organizer console: sign up, sign in and workspace all live here, never on ChamaManager. */}
          <Route path="/organizer/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
          <Route path="/organizer/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
          <Route path="/organizer" element={<RequireOrganizer />}>
            <Route index element={<ConsolePage />} />
            <Route path="new" element={<NewFundraiserPage />} />
            <Route path="groups/:groupId" element={<GroupWorkspacePage />} />
          </Route>
          <Route path="/:joinCode" element={<GivingPage />} />
          <Route path="/" element={<GivingPage />} />
        </Routes>
      </OrganizerAuthProvider>
    </BrowserRouter>
    <Toaster position="top-center" />
  </React.StrictMode>,
);
