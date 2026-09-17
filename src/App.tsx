import { Route, Routes } from "react-router-dom";
import { FlipTableContainer } from "./containers/FlipTableContainer";
import { HighVolumeItemsContainer } from "./containers/HighVolumeItemsContainer";
import { ItemProfitScanContainer } from "./containers/ItemProfitScanContainer";

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<FlipTableContainer />} />
      <Route path="/high-volume-items" element={<HighVolumeItemsContainer />} />
      <Route path="/item/:itemId" element={<ItemProfitScanContainer />} />
    </Routes>
  );
};

export default App;
