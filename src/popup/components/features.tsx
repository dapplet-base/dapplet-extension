import * as React from "react";
import { initBGFunctions } from "chrome-extension-message-wrapper";
import * as extension from 'extensionizer';

import { Button, Image, List, Checkbox, Segment, Message, Popup, Label, Divider } from "semantic-ui-react";
import ManifestDTO from "../../background/dto/manifestDTO";
import { ModuleTypes } from "../../common/constants";

interface IFeaturesProps {
  contextIds: string[] | undefined;
}

interface IFeaturesState {
  features: ManifestDTO[];
  isLoading: boolean;
  error: string;
  isNoInpage: boolean;
}

class Features extends React.Component<IFeaturesProps, IFeaturesState> {
  private _isMounted: boolean = false;

  constructor(props) {
    super(props);

    this.state = {
      features: [],
      isLoading: true,
      error: null,
      isNoInpage: false
    };
  }

  async componentDidMount() {
    this._isMounted = true;
    const { contextIds } = this.props;
    if (contextIds === undefined) {
      this.setState({ isNoInpage: true, isLoading: false });
      return;
    }

    const { getFeaturesByHostnames, getRegistries } = await initBGFunctions(extension);

    const registries = await getRegistries();
    const regsWithErrors = registries.filter(r => !!r.error).length;
    if (regsWithErrors > 0) {
      this.setState({
        error: `There are registries with connection problems. Please check the settings.`
      });
    }
    const features: ManifestDTO[] = await getFeaturesByHostnames(contextIds);
    if (this._isMounted) {
      this.setState({
        features: features.filter(f => f.type === ModuleTypes.Feature),
        isLoading: false
      });
    }
  }

  async handleSwitchChange(module: ManifestDTO, value, order) {
    const { name, hostnames, sourceRegistry } = module;
    const backgroundFunctions = await initBGFunctions(extension);
    const { activateFeature, deactivateFeature } = backgroundFunctions;
    this.setState(state => {
      const features = state.features.map(feature => {
        if (feature.name == name) {
          feature.isActive = value;
        }
        return feature;
      });

      return { features };
    });

    if (value) {
      await activateFeature(name, null, hostnames, order, sourceRegistry.url);
    } else {
      await deactivateFeature(name, null, hostnames, order, sourceRegistry.url);
    }
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  refreshContextPage() {
    extension.tabs.query({
      active: true,
      currentWindow: true
    }, ([{ id, url }]) => {
      chrome.tabs.update(id, { url });
      window.close();
    });
  }

  render() {
    const { features, isLoading, error, isNoInpage } = this.state;
    return (
      <React.Fragment>
        <Segment loading={isLoading} className="internalTab">
          {(error) ? (<Message floating warning>{error}</Message>) : null}

          {!isNoInpage ?
            (features.length > 0) ? (
              <List divided relaxed>
                {features.map((f, i) => (
                  <List.Item key={i} style={{ overflow: "hidden" }}>
                    <List.Content style={{ width: 45, float: "left" }}>
                      <Popup trigger={<Image size="mini" avatar alt={f.description} src={(f.icon?.uris?.[0]?.indexOf('bzz:/') !== -1) ? 'https://swarm-gateways.net/' + f.icon?.uris?.[0] : f.icon?.uris?.[0]} />}>
                        <h4>Related Context IDs</h4>
                        <List>{f.hostnames?.map((h, j) => <List.Item key={j}>{h}</List.Item>)}</List>

                        <h4>Source registry</h4>
                        <List>{f.sourceRegistry.url}</List>
                      </Popup>
                    </List.Content>
                    <List.Content style={{ float: "right", width: 60 }}>
                      <Checkbox
                        toggle
                        style={{ marginTop: 5 }}
                        onChange={() => this.handleSwitchChange(f, !f.isActive, i)}
                        checked={f.isActive}
                      />
                    </List.Content>
                    <List.Content style={{ marginLeft: 45, marginRight: 60 }} >
                      <List.Header>
                        {f.title}
                        {(f.sourceRegistry.isDev) ? (<Label style={{ marginLeft: 5 }} horizontal size='mini' color='teal'>DEV</Label>) : null}
                      </List.Header>
                      <List.Description style={{ color: "#666" }}>
                        {f.description}
                        {f.sourceRegistry.isDev ? null : <React.Fragment><br/>Author: {f.author}</React.Fragment>}
                      </List.Description>
                    </List.Content>
                  </List.Item>
                ))}
              </List>
            ) : (<div>No available features for current site.</div>)
            : (<div>
              No connection with context webpage.
              <br />
              Please refresh it.
              <br />
              <Button
                compact
                size='tiny'
                color='blue'
                content='Refresh'
                onClick={() => this.refreshContextPage()}
              />
            </div>)}
        </Segment>
      </React.Fragment>
    );
  }
}

export default Features;
