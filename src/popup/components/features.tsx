import * as React from "react";
import { initBGFunctions } from "chrome-extension-message-wrapper";
import store from "../store";
import * as extension from 'extensionizer';

import { Button, Image, List, Checkbox, Segment, Message } from "semantic-ui-react";

interface IFeaturesProps {

}

interface IFeaturesState {
  features: any[];
  isLoading: boolean;
  error: string;
}

class FeatureList extends React.Component<IFeaturesProps, IFeaturesState> {
  constructor(props) {
    super(props);

    this.state = {
      features: [],
      isLoading: true,
      error: null
    };
  }

  async componentDidMount() {
    const backgroundFunctions = await initBGFunctions(extension);
    const getFeaturesByHostname: (id: string) => Promise<any[]> = backgroundFunctions.getFeaturesByHostname;

    try {
      const features = (await Promise.all(store.currentContextIds.map(id => getFeaturesByHostname(id)))).reduce((acc, val) => acc.concat(val), []);
      this.setState({
        features,
        isLoading: false,
        error: null
      });
    } catch {
      this.setState({
        error: "The registry is not available.",
        isLoading: false
      });
    }
  }

  async handleSwitchChange({ name, version }, value) {
    const backgroundFunctions = await initBGFunctions(extension);
    const { activateFeature, deactivateFeature } = backgroundFunctions;

    if (value) {
      await activateFeature(name, version, store.currentContextIds[0]);
    } else {
      await deactivateFeature(name, version, store.currentContextIds[0]);
    }

    this.setState(state => {
      const features = state.features.map(feature => {
        if (feature.name == name) {
          feature.isActive = value;
        }
        return feature;
      });

      return { features };
    });
  }

  render() {
    const { features, isLoading, error } = this.state;
    return (
      <React.Fragment>
        <Segment loading={isLoading} className="internalTab">
          {(!error) ? ((features.length > 0) ? (
            <List divided relaxed style={{ width: 350 }}>
              {features.map(f => (
                <List.Item key={f.name} style={{ overflow: "hidden" }}>
                  <List.Content style={{ width: 45, float: "left" }}>
                    <div>
                      <Image
                        size="mini"
                        avatar
                        alt={f.description}
                        src={f.icon}
                      />
                    </div>
                  </List.Content>
                  {f.hasUpdate ? ( // ToDo: hasUpdate isn't implemented in DTO
                    <List.Content style={{ float: "right", width: 60 }}>
                      <Button
                        primary
                        size="mini"
                        style={{ padding: 5, width: 55 }}
                      >
                        Update
                    </Button>
                      <Button
                        size="mini"
                        style={{ padding: 5, marginTop: 5, width: 55 }}
                      >
                        Skip
                    </Button>
                    </List.Content>
                  ) : (
                      <List.Content style={{ float: "right", width: 60 }}>
                        <Checkbox
                          toggle
                          style={{ marginTop: 5 }}
                          onChange={() =>
                            this.handleSwitchChange(f, !f.isActive)
                          }
                          checked={f.isActive}
                        />
                      </List.Content>
                    )}
                  <List.Content
                    style={{
                      marginLeft: 45,
                      marginRight: f.hasUpdate ? 60 : 60
                    }}
                  >
                    <List.Header>{f.title}</List.Header>
                    <List.Description style={{ color: "#666" }}>
                      {f.description}
                      <br />
                      Author: {f.author}
                      <br />
                      Version: {f.version}
                    </List.Description>
                  </List.Content>
                </List.Item>
              ))}
            </List>
          ) : (<div>No available features for current site.</div>)) : (<Message floating negative>{error}</Message>)}
        </Segment>
      </React.Fragment>
    );
  }
}

export default FeatureList;
