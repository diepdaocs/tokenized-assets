import { Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import DeployAsset from './pages/DeployAsset';
import AssetDetail from './pages/AssetDetail';
import AdminPanel from './pages/AdminPanel';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/deploy" element={<DeployAsset />} />
        <Route path="/asset/:address" element={<AssetDetail />} />
        <Route path="/admin" element={<AdminPanel />} />
      </Routes>
    </Layout>
  );
}

export default App;
